import "../src/server/load-env";
import { createHash } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { closeDb, getDb } from "../src/server/db/client";
import { categories, collections, deliverySlots, deliveryZones, media, productCollections, productImages, products, productVariants, settings, zonePincodes } from "../src/server/db/schema";
import { getEnv } from "../src/server/env";
import { putObject } from "../src/server/storage";
import { illustrationSvg, type IllustrationKind } from "../src/lib/illustrations";
import type { SaleUnit } from "../src/lib/units";

/**
 * Sample catalogue for local development and the hosted preview ONLY, so the
 * shopping flow can be tried end to end. Prices, stock and delivery settings
 * here are illustrative, not Swastik's real prices. Every product says it is a
 * sample. Refused when APP_STAGE=production, and needs SEED_SAMPLE_DATA=true.
 */

type SampleVariant = { label: string; unit: SaleUnit; price: number; sale?: number; stock: number; min?: number; track?: boolean };
type SampleProduct = { name: string; category: string; art: IllustrationKind; short: string; description: string; usage: string; care?: string; tags: string[]; featured?: boolean; bestseller?: boolean; collections?: string[]; variants: SampleVariant[] };

const NOTE = "\n\nThis is a sample product on the preview site. It is not for sale.";

const PRODUCTS: SampleProduct[] = [
  {
    name: "Marigold Flowers, Loose",
    category: "marigold-flowers",
    art: "marigold",
    short: "Bright orange and yellow genda flowers, sold by weight.",
    description: "Fresh loose marigold flowers for offering, decoration and making your own garlands. Colours are a natural mix of orange and yellow." + NOTE,
    usage: "Offered at daily and festival pujas, scattered during aarti and strung into garlands.",
    care: "Sprinkle lightly with water and keep in a cool, shaded place.",
    tags: ["marigold", "genda", "loose flowers", "daily puja"],
    featured: true,
    bestseller: true,
    collections: ["durga-puja-flowers", "kali-puja-and-diwali-flowers"],
    variants: [
      { label: "250 g", unit: "pack", price: 4000, stock: 40 },
      { label: "500 g", unit: "pack", price: 7500, stock: 30 },
      { label: "1 kg", unit: "pack", price: 14000, sale: 13000, stock: 20 },
    ],
  },
  {
    name: "Marigold Garland",
    category: "flower-garlands",
    art: "garland",
    short: "A full marigold mala, about 3 feet long.",
    description: "A ready-made garland of tightly strung marigold flowers, suitable for deity idols, photographs and doorways." + NOTE,
    usage: "Used to adorn deities and photographs, and for welcoming guests at religious events.",
    tags: ["garland", "mala", "marigold"],
    featured: true,
    bestseller: true,
    collections: ["durga-puja-flowers", "lakshmi-puja-flowers"],
    variants: [
      { label: "3 ft", unit: "garland", price: 6000, stock: 25 },
      { label: "5 ft", unit: "garland", price: 9500, stock: 10 },
    ],
  },
  {
    name: "Red Hibiscus (Jaba)",
    category: "hibiscus-flowers",
    art: "hibiscus",
    short: "Fresh red jaba flowers, sold by the piece.",
    description: "Deep red hibiscus flowers, picked to open on the day of delivery. Each flower is sold individually." + NOTE,
    usage: "Closely associated with the worship of Goddess Kali in Bengal.",
    care: "Hibiscus flowers last about a day after opening. Use them on the day you receive them.",
    tags: ["hibiscus", "jaba", "kali puja"],
    featured: true,
    collections: ["kali-puja-and-diwali-flowers"],
    variants: [{ label: "", unit: "piece", price: 500, stock: 200, min: 5 }],
  },
  {
    name: "Red Roses",
    category: "rose-flowers",
    art: "rose",
    short: "Red roses in a bunch of 10 stems.",
    description: "Fresh red roses with stems, tied in a bunch. Suitable for offering and decoration." + NOTE,
    usage: "Offered to many deities and used in garlands and altar decoration.",
    care: "Trim the stems and stand them in clean water.",
    tags: ["rose", "golap"],
    bestseller: true,
    variants: [{ label: "Bunch of 10", unit: "bunch", price: 12000, stock: 15 }],
  },
  {
    name: "Rose Petals",
    category: "rose-flowers",
    art: "rose",
    short: "Loose rose petals for offerings and aarti.",
    description: "Loose red and pink rose petals, ready for scattering during puja or decorating the thali." + NOTE,
    usage: "Scattered during aarti and special pujas.",
    tags: ["rose", "petals"],
    variants: [{ label: "100 g", unit: "pack", price: 5000, stock: 0 }],
  },
  {
    name: "Jasmine (Bela) String",
    category: "jasmine-and-mogra",
    art: "jasmine",
    short: "Fragrant jasmine buds strung together, sold per string.",
    description: "Jasmine buds strung into a soft string about one arm's length long. The buds open through the day and release their fragrance." + NOTE,
    usage: "Offered to deities and used to decorate the altar.",
    care: "Wrap loosely in a damp cotton cloth until use.",
    tags: ["jasmine", "bela", "mogra", "fragrant"],
    variants: [{ label: "", unit: "string", price: 3000, stock: 30 }],
  },
  {
    name: "Lotus Flower",
    category: "lotus-flowers",
    art: "lotus",
    short: "Pink lotus buds, sold by the piece.",
    description: "Pink lotus buds that open gradually. Each piece is one flower with a short stem." + NOTE,
    usage: "Associated with Goddess Lakshmi and Goddess Saraswati, and offered during Durga Puja.",
    tags: ["lotus", "padma", "lakshmi puja", "durga puja"],
    featured: true,
    collections: ["durga-puja-flowers", "lakshmi-puja-flowers", "saraswati-puja-flowers"],
    variants: [{ label: "", unit: "piece", price: 2500, stock: 50 }],
  },
  {
    name: "Bel Patra (Bilva Leaves)",
    category: "bel-patra-and-puja-leaves",
    art: "leaves",
    short: "Fresh three-leaflet bel leaves, sold in bundles of 21.",
    description: "Fresh bel leaves with three leaflets on each stalk, tied in a bundle of 21." + NOTE,
    usage: "Offered to Lord Shiva, especially on Mondays and Maha Shivratri.",
    care: "Keep wrapped in a damp cloth in a cool place.",
    tags: ["bel", "bilva", "shiva", "leaves"],
    collections: ["maha-shivratri-flowers"],
    variants: [{ label: "21 leaves", unit: "bundle", price: 3000, stock: 40 }],
  },
  {
    name: "Daily Puja Flower Pack",
    category: "daily-puja-flower-packs",
    art: "daily",
    short: "A small mixed pack for one day's household puja.",
    description: "A mixed pack of marigold, a few seasonal flowers and leaves, sized for a household's daily puja." + NOTE,
    usage: "For everyday worship at home.",
    tags: ["daily puja", "mixed", "pack"],
    featured: true,
    bestseller: true,
    variants: [
      { label: "Small", unit: "pack", price: 4900, stock: 0, track: false },
      { label: "Large", unit: "pack", price: 8900, stock: 0, track: false },
    ],
  },
  {
    name: "Mixed Flower Bundle",
    category: "mixed-flower-bundles",
    art: "bundle",
    short: "Marigold, roses and white flowers bundled together.",
    description: "An assorted bundle of seasonal flowers for offering and decoration." + NOTE,
    usage: "Useful for pujas where several kinds of flowers are offered.",
    tags: ["mixed", "bundle", "assorted"],
    variants: [{ label: "", unit: "bundle", price: 15000, stock: 8 }],
  },
];

async function imageFor(kind: IllustrationKind, name: string) {
  const db = getDb();
  const webp = await sharp(Buffer.from(illustrationSvg(kind))).resize(900, 900).webp({ quality: 82 }).toBuffer();
  const sha = createHash("sha256").update(webp).digest("hex");
  const key = `images/${sha.slice(0, 2)}/${sha}.webp`;
  await putObject(key, webp, "image/webp");
  const filename = `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-illustration.webp`;
  const [row] = await db.insert(media).values({ storageKey: key, filename, contentType: "image/webp", size: webp.length, width: 900, height: 900, sha256: sha, alt: `Illustration of ${name.toLowerCase()}` }).returning();
  return row;
}

async function main() {
  const env = getEnv();
  if (env.APP_STAGE === "production") throw new Error("Refusing to add sample data when APP_STAGE=production.");
  if (process.env.SEED_SAMPLE_DATA !== "true") throw new Error("Set SEED_SAMPLE_DATA=true to add the sample catalogue (development and preview only).");
  const db = getDb();
  const [done] = await db.select().from(settings).where(eq(settings.key, "_seed_sample_v1"));
  if (done) {
    console.log("Sample data already added");
    return;
  }
  const cats = await db.select().from(categories);
  const cols = await db.select().from(collections);
  if (!cats.length) throw new Error("Run npm run db:seed first.");
  let sku = 100;
  for (const [i, p] of PRODUCTS.entries()) {
    const cat = cats.find((c) => c.slug === p.category);
    const [prod] = await db
      .insert(products)
      .values({
        name: p.name,
        slug: p.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        categoryId: cat?.id ?? null,
        shortDescription: p.short,
        description: p.description,
        usageInfo: p.usage,
        careInfo: p.care ?? "",
        unit: p.variants[0].unit,
        tags: p.tags,
        status: "published",
        isFeatured: !!p.featured,
        isBestseller: !!p.bestseller,
        sortOrder: i,
        publishedAt: new Date(),
      })
      .returning();
    for (const [vi, v] of p.variants.entries()) {
      await db.insert(productVariants).values({
        productId: prod.id,
        label: v.label,
        sku: `SMP-${sku++}`,
        unit: v.unit,
        pricePaise: v.price,
        salePricePaise: v.sale ?? null,
        trackInventory: v.track ?? true,
        stockQuantity: v.stock,
        minOrderQty: v.min ?? 1,
        sortOrder: vi,
      });
    }
    const img = await imageFor(p.art, p.name);
    await db.insert(productImages).values({ productId: prod.id, mediaId: img.id, alt: `Illustration of ${p.name.toLowerCase()}`, sortOrder: 0 });
    for (const slug of p.collections ?? []) {
      const col = cols.find((c) => c.slug === slug);
      if (col) await db.insert(productCollections).values({ productId: prod.id, collectionId: col.id }).onConflictDoNothing();
    }
  }
  // Category tiles use the same illustrations.
  for (const c of cats) {
    const kind = PRODUCTS.find((p) => p.category === c.slug)?.art;
    if (kind) {
      const img = await imageFor(kind, c.name);
      await db.update(categories).set({ imageId: img.id }).where(eq(categories.id, c.id));
    }
  }
  // A sample delivery set-up so checkout can be tried: the Rishra zone with illustrative fees and slots.
  const [zone] = await db.select().from(deliveryZones).where(eq(deliveryZones.slug, "rishra"));
  if (zone) {
    await db
      .update(deliveryZones)
      .set({ isActive: true, deliveryFeePaise: 3000, minOrderPaise: 10000, freeDeliveryAbovePaise: 50000, minLeadDays: 1, instructions: "Sample delivery settings for the preview site." })
      .where(eq(deliveryZones.id, zone.id));
    await db.insert(zonePincodes).values({ pincode: "712248", zoneId: zone.id, localities: "Rishra" }).onConflictDoNothing();
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(deliverySlots).where(eq(deliverySlots.zoneId, zone.id));
    if (n === 0) {
      await db.insert(deliverySlots).values([
        { zoneId: zone.id, label: "Early morning, 6 to 8 am", startTime: "06:00", endTime: "08:00", cutoffMinutes: 600, sortOrder: 0 },
        { zoneId: zone.id, label: "Morning, 8 to 11 am", startTime: "08:00", endTime: "11:00", cutoffMinutes: 600, sortOrder: 1 },
        { zoneId: zone.id, label: "Evening, 4 to 7 pm", startTime: "16:00", endTime: "19:00", cutoffMinutes: 240, sortOrder: 2 },
      ]);
    }
  }
  await db.insert(settings).values({ key: "_seed_sample_v1", value: { at: new Date().toISOString() } });
  console.log(`Sample catalogue added: ${PRODUCTS.length} products, and sample delivery settings for PIN 712248.`);
}

main()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error(err instanceof Error ? err.message : err);
    await closeDb();
    process.exit(1);
  });

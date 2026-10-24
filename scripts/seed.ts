import "../src/server/load-env";
import { eq, sql } from "drizzle-orm";
import { closeDb, getDb } from "../src/server/db/client";
import { articles, categories, collections, deliveryZones, faqs, pages, settings, zonePincodes } from "../src/server/db/schema";
import { CATEGORIES, COLLECTIONS, FAQS, GUIDES, PAGES } from "./seed-content";

/**
 * Base content for a new site. Runs on every deploy and is idempotent: each part
 * is added once (tracked in the settings table) and never overwrites the owner's
 * later changes. No products, prices or offers are created here.
 */

const MARKER = "_seed_base_v1";

async function main() {
  const db = getDb();
  const [done] = await db.select().from(settings).where(eq(settings.key, MARKER));
  if (done) {
    console.log("Base content already seeded");
    return;
  }
  await db.transaction(async (tx) => {
    const [{ n: catCount }] = await tx.select({ n: sql<number>`count(*)::int` }).from(categories);
    const catIds = new Map<string, string>();
    if (catCount === 0) {
      for (const [i, c] of CATEGORIES.entries()) {
        const [row] = await tx.insert(categories).values({ ...c, sortOrder: i * 10 }).returning({ id: categories.id });
        catIds.set(c.slug, row.id);
      }
    }
    const [{ n: colCount }] = await tx.select({ n: sql<number>`count(*)::int` }).from(collections);
    if (colCount === 0) for (const [i, c] of COLLECTIONS.entries()) await tx.insert(collections).values({ ...c, sortOrder: i * 10 });

    const [{ n: faqCount }] = await tx.select({ n: sql<number>`count(*)::int` }).from(faqs);
    if (faqCount === 0) for (const [i, f] of FAQS.entries()) await tx.insert(faqs).values({ ...f, sortOrder: i * 10, isPublished: true });

    for (const p of PAGES) await tx.insert(pages).values({ ...p, isPublished: false }).onConflictDoNothing();

    for (const g of GUIDES) {
      await tx
        .insert(articles)
        .values({ slug: g.slug, title: g.title, excerpt: g.excerpt, body: g.body, status: "draft", relatedCategoryId: g.category ? (catIds.get(g.category) ?? null) : null })
        .onConflictDoNothing();
    }

    // The first service area, created inactive: the owner confirms PIN codes, fees and slots before switching it on.
    const [{ n: zoneCount }] = await tx.select({ n: sql<number>`count(*)::int` }).from(deliveryZones);
    if (zoneCount === 0) {
      const [zone] = await tx
        .insert(deliveryZones)
        .values({
          name: "Rishra",
          slug: "rishra",
          isActive: false,
          minLeadDays: 1,
          maxAdvanceDays: 14,
          instructions: "",
        })
        .returning({ id: deliveryZones.id });
      await tx.insert(zonePincodes).values({ pincode: "712248", zoneId: zone.id, localities: "Rishra" }).onConflictDoNothing();
    }
    await tx.insert(settings).values({ key: MARKER, value: { at: new Date().toISOString() } });
  });
  console.log("Base content seeded: categories, collections, FAQs, draft pages and guides, and an inactive Rishra delivery zone");
}

main()
  .then(() => closeDb())
  .catch(async (err) => {
    console.error(err);
    await closeDb();
    process.exit(1);
  });

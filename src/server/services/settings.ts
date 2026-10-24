import { inArray } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "../db/client";
import { settings } from "../db/schema";

/**
 * Business settings managed from the admin panel. Defaults deliberately leave
 * contact details empty: nothing about the business is invented, and features
 * that depend on a detail (WhatsApp button, LocalBusiness data) stay hidden
 * until the owner fills it in.
 */

const optionalUrl = z.string().trim().max(300).refine((v) => v === "" || /^https?:\/\//.test(v), "Must start with https://").default("");

export const businessSchema = z.object({
  name: z.string().trim().min(1).max(80).default("Swastik"),
  tagline: z.string().trim().max(160).default("Fresh puja flowers, delivered"),
  phone: z.string().trim().max(20).default(""),
  whatsapp: z.string().trim().max(20).default(""),
  email: z.string().trim().max(120).default(""),
  // Where new order and enquiry alerts go.
  notificationEmail: z.string().trim().max(120).default(""),
  addressLine: z.string().trim().max(200).default(""),
  locality: z.string().trim().max(80).default("Rishra"),
  city: z.string().trim().max(80).default("Rishra"),
  district: z.string().trim().max(80).default("Hooghly"),
  state: z.string().trim().max(80).default("West Bengal"),
  pincode: z.string().trim().max(6).default(""),
  mapUrl: optionalUrl,
  hours: z.string().trim().max(200).default(""),
  gstin: z.string().trim().max(20).default(""),
  // The owner confirms the address and phone are accurate; only then is LocalBusiness structured data published.
  detailsVerified: z.boolean().default(false),
  social: z
    .object({ facebook: optionalUrl, instagram: optionalUrl, youtube: optionalUrl, googleBusiness: optionalUrl })
    .default({}),
});

export const checkoutSchema = z.object({
  onlinePaymentsEnabled: z.boolean().default(true),
  // Cash on Delivery stays off until the business turns it on.
  codEnabled: z.boolean().default(false),
  codMaxOrderPaise: z.number().int().min(0).nullable().default(null),
  paymentWindowMinutes: z.number().int().min(10).max(180).default(30),
  lowStockThreshold: z.number().int().min(0).max(1000).default(5),
  maxQuantityPerLine: z.number().int().min(1).max(1000).default(50),
  // Shown on the checkout page, e.g. substitution policy.
  checkoutNote: z.string().trim().max(500).default(""),
  acceptingOrders: z.boolean().default(true),
  pausedMessage: z.string().trim().max(300).default("We are not taking new orders right now. Please check back soon."),
});

const sectionToggles = z
  .object({
    categories: z.boolean().default(true),
    popular: z.boolean().default(true),
    daily: z.boolean().default(true),
    garlands: z.boolean().default(true),
    collections: z.boolean().default(true),
    bestsellers: z.boolean().default(true),
    offers: z.boolean().default(true),
    why: z.boolean().default(true),
    delivery: z.boolean().default(true),
    bulk: z.boolean().default(true),
    reviews: z.boolean().default(true),
    guides: z.boolean().default(true),
    faq: z.boolean().default(true),
  })
  .default({});

export const homepageSchema = z.object({
  announcementEnabled: z.boolean().default(false),
  announcementText: z.string().trim().max(160).default(""),
  announcementHref: z.string().trim().max(200).default(""),
  heroEyebrow: z.string().trim().max(80).default("Puja flowers in Rishra, Hooghly"),
  heroTitle: z.string().trim().max(120).default("Fresh flowers for every puja, ordered in minutes"),
  heroSubtitle: z
    .string()
    .trim()
    .max(300)
    .default("Marigold, rose, jasmine, lotus, garlands and daily puja packs. Choose your quantity, pick a delivery slot and check out without creating an account."),
  heroCtaLabel: z.string().trim().max(40).default("Shop flowers"),
  heroCtaHref: z.string().trim().max(200).default("/shop"),
  sections: sectionToggles,
  featuredCategoryIds: z.array(z.string().uuid()).default([]),
  popularProductIds: z.array(z.string().uuid()).default([]),
  dailyCategoryId: z.string().uuid().nullable().default(null),
  garlandCategoryIds: z.array(z.string().uuid()).default([]),
  whyTitle: z.string().trim().max(80).default("Why order from Swastik"),
  whyItems: z
    .array(z.object({ title: z.string().trim().min(1).max(60), body: z.string().trim().max(240) }))
    .max(6)
    .default([
      { title: "No account needed", body: "Add flowers to your cart and check out as a guest. Your cart stays on this device until you order." },
      { title: "Clear prices and units", body: "Every price says exactly what you get: per piece, per bunch, per garland or per pack." },
      { title: "Choose your delivery slot", body: "Pick a delivery date and time slot that suits your puja, in the areas we currently serve." },
      { title: "Help for mandirs", body: "Temples, pandits and puja committees can request a bulk quote for one-time or regular requirements." },
    ]),
  bulkTitle: z.string().trim().max(100).default("Flowers for mandirs and large pujas"),
  bulkBody: z
    .string()
    .trim()
    .max(400)
    .default("Tell us the flowers, quantities and dates you need. We review availability and pricing, then contact you with a quotation."),
});

export const seoSchema = z.object({
  titleTemplate: z.string().trim().max(80).default("%s | Swastik Puja Flowers"),
  defaultTitle: z.string().trim().max(80).default("Swastik | Fresh Puja Flowers in Rishra, Hooghly"),
  defaultDescription: z
    .string()
    .trim()
    .max(200)
    .default("Order fresh puja flowers, garlands and daily puja flower packs online from Swastik in Rishra, Hooghly. Clear prices, guest checkout and bulk orders for mandirs."),
  ogImageId: z.string().uuid().nullable().default(null),
  googleSiteVerification: z.string().trim().max(120).default(""),
});

export const notificationSettingsSchema = z.object({
  emailOwnerOnNewOrder: z.boolean().default(true),
  emailOwnerOnBulkEnquiry: z.boolean().default(true),
  emailCustomers: z.boolean().default(true),
});

export const SETTINGS = {
  business: businessSchema,
  checkout: checkoutSchema,
  homepage: homepageSchema,
  seo: seoSchema,
  notifications: notificationSettingsSchema,
} as const;

export type SettingsKey = keyof typeof SETTINGS;
export type SettingsValue<K extends SettingsKey> = z.infer<(typeof SETTINGS)[K]>;
export type AllSettings = { [K in SettingsKey]: SettingsValue<K> };

export async function getSettings<K extends SettingsKey>(db: DbOrTx, key: K): Promise<SettingsValue<K>> {
  const all = await getAllSettings(db, [key]);
  return all[key];
}

export async function getAllSettings(db: DbOrTx, keys: SettingsKey[] = Object.keys(SETTINGS) as SettingsKey[]): Promise<AllSettings> {
  const rows = await db.select().from(settings).where(inArray(settings.key, keys));
  const out = {} as Record<string, unknown>;
  for (const key of Object.keys(SETTINGS) as SettingsKey[]) {
    const stored = rows.find((r) => r.key === key)?.value ?? {};
    const parsed = SETTINGS[key].safeParse(stored);
    // A stored value that no longer matches the schema falls back to defaults rather than breaking the site.
    out[key] = parsed.success ? parsed.data : SETTINGS[key].parse({});
  }
  return out as AllSettings;
}

export async function saveSettings<K extends SettingsKey>(db: DbOrTx, key: K, value: unknown): Promise<SettingsValue<K>> {
  const parsed = SETTINGS[key].parse(value) as SettingsValue<K>;
  await db
    .insert(settings)
    .values({ key, value: parsed as object })
    .onConflictDoUpdate({ target: settings.key, set: { value: parsed as object, updatedAt: new Date() } });
  return parsed;
}

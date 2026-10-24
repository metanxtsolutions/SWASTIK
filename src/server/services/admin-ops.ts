import { asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database, DbOrTx } from "../db/client";
import {
  articles,
  auditLogs,
  banners,
  contactMessages,
  coupons,
  deliveryBlackouts,
  deliverySlots,
  deliveryZones,
  faqs,
  media,
  orders,
  pages,
  redirects,
  testimonials,
  zonePincodes,
} from "../db/schema";
import { ConflictError, NotFoundError, ValidationError } from "../errors";
import { parseRupeesToPaise } from "@/lib/money";
import { isIsoDate } from "@/lib/dates";
import { slugify, SLUG_PATTERN } from "@/lib/slug";
import { uploadImage } from "./admin-catalog";
import { fieldErrorsFromZod } from "./orders";

/** Admin management of delivery, coupons and site content. */

function parse<T extends z.ZodTypeAny>(schema: T, raw: unknown): z.infer<T> {
  const r = schema.safeParse(raw);
  if (!r.success) throw new ValidationError("Please fix the highlighted fields.", fieldErrorsFromZod(r.error));
  return r.data;
}

const optionalMoney = z
  .string()
  .optional()
  .nullable()
  .transform((v, ctx) => {
    if (!v || !v.trim()) return null;
    const p = parseRupeesToPaise(v);
    if (p === null) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter an amount in rupees" });
    return p;
  });
const requiredMoney = optionalMoney.transform((v) => v ?? 0);
const int = (min: number, max: number, fallback: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || String(v).trim() === "" ? fallback : Number(v)))
    .refine((v) => Number.isInteger(v) && v >= min && v <= max, `Enter a whole number from ${min} to ${max}`);
const timeField = z
  .string()
  .optional()
  .nullable()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v), "Enter a time like 18:00");

function unique(e: unknown) {
  return (e as { code?: string }).code === "23505";
}

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------

export const zoneSchema = z.object({
  name: z.string().trim().min(2, "Enter a zone name").max(80),
  slug: z.string().trim().max(80).optional().default(""),
  isActive: z.boolean().default(false),
  deliveryFee: requiredMoney,
  minOrder: requiredMoney,
  freeDeliveryAbove: optionalMoney,
  minLeadDays: int(0, 30, 1),
  maxAdvanceDays: int(1, 90, 14),
  sameDayEnabled: z.boolean().default(false),
  sameDayCutoff: timeField,
  instructions: z.string().trim().max(500).default(""),
  landingPublished: z.boolean().default(false),
  landingTitle: z.string().trim().max(100).default(""),
  landingContent: z.string().trim().max(5000).default(""),
  sortOrder: int(-1000, 1000, 0),
  pincodes: z.string().max(20_000).default(""),
});

/** One PIN code per line, optionally followed by a comma and the localities it covers. */
export function parsePincodeLines(text: string): { pincode: string; localities: string }[] {
  const out = new Map<string, string>();
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(/^([1-9]\d{5})\s*(?:[,:\-–]\s*(.*))?$/);
    if (!m) {
      bad.push(line.slice(0, 30));
      continue;
    }
    out.set(m[1], (m[2] ?? "").trim().slice(0, 300));
  }
  if (bad.length) throw new ValidationError(`These lines are not valid PIN codes: ${bad.slice(0, 5).join("; ")}`, { pincodes: "Check the PIN codes" });
  return [...out].map(([pincode, localities]) => ({ pincode, localities }));
}

export async function saveZone(db: Database, id: string | null, raw: unknown) {
  const z0 = parse(zoneSchema, raw);
  if (z0.sameDayEnabled && z0.minLeadDays > 0) throw new ValidationError("Same-day delivery needs a lead time of 0 days.", { minLeadDays: "Set to 0 for same-day" });
  if (z0.sameDayEnabled && !z0.sameDayCutoff) throw new ValidationError("Set the time after which same-day orders close.", { sameDayCutoff: "Required for same-day" });
  const pins = parsePincodeLines(z0.pincodes);
  if (z0.isActive && !pins.length) throw new ValidationError("Add at least one PIN code before activating the zone.", { pincodes: "Required" });
  const slug = z0.slug ? slugify(z0.slug) : slugify(z0.name);
  const values = {
    name: z0.name,
    slug,
    isActive: z0.isActive,
    deliveryFeePaise: z0.deliveryFee,
    minOrderPaise: z0.minOrder,
    freeDeliveryAbovePaise: z0.freeDeliveryAbove,
    minLeadDays: z0.minLeadDays,
    maxAdvanceDays: z0.maxAdvanceDays,
    sameDayEnabled: z0.sameDayEnabled,
    sameDayCutoff: z0.sameDayCutoff,
    instructions: z0.instructions,
    landingPublished: z0.landingPublished,
    landingTitle: z0.landingTitle,
    landingContent: z0.landingContent,
    sortOrder: z0.sortOrder,
    updatedAt: new Date(),
  };
  try {
    return await db.transaction(async (tx) => {
      let zoneId = id;
      if (zoneId) {
        const [row] = await tx.update(deliveryZones).set(values).where(eq(deliveryZones.id, zoneId)).returning();
        if (!row) throw new NotFoundError("Zone not found");
      } else {
        zoneId = (await tx.insert(deliveryZones).values(values).returning({ id: deliveryZones.id }))[0].id;
      }
      // A PIN code belongs to one zone; adding it here moves it from any other zone.
      await tx.delete(zonePincodes).where(eq(zonePincodes.zoneId, zoneId));
      if (pins.length) {
        await tx
          .insert(zonePincodes)
          .values(pins.map((p) => ({ ...p, zoneId: zoneId! })))
          .onConflictDoUpdate({ target: zonePincodes.pincode, set: { zoneId: sql`excluded.zone_id`, localities: sql`excluded.localities` } });
      }
      return zoneId;
    });
  } catch (e) {
    if (unique(e)) throw new ValidationError("Another zone already uses this name or slug.", { name: "Already in use" });
    throw e;
  }
}

export async function deleteZone(db: DbOrTx, id: string) {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(orders)
    .where(sql`${orders.zoneId} = ${id} AND ${orders.status} NOT IN ('delivered', 'cancelled')`);
  if (n > 0) throw new ConflictError(`This zone has ${n} open order${n === 1 ? "" : "s"}. Deactivate it instead, and delete it once those orders are complete.`);
  await db.delete(deliveryZones).where(eq(deliveryZones.id, id));
}

export const slotSchema = z
  .object({
    label: z.string().trim().max(60).default(""),
    startTime: timeField.refine((v) => v !== null, "Enter a start time"),
    endTime: timeField.refine((v) => v !== null, "Enter an end time"),
    cutoffMinutes: int(0, 7 * 24 * 60, 120),
    capacity: z
      .string()
      .optional()
      .transform((v) => (v && v.trim() ? Number(v) : null))
      .refine((v) => v === null || (Number.isInteger(v) && v > 0 && v <= 10000), "Enter a whole number or leave empty"),
    daysOfWeek: z.array(z.coerce.number().int().min(0).max(6)).min(1, "Choose at least one day"),
    isActive: z.boolean().default(true),
    sortOrder: int(-1000, 1000, 0),
  })
  .refine((s) => !s.startTime || !s.endTime || s.endTime > s.startTime, { message: "The end time must be after the start time", path: ["endTime"] });

export async function saveSlot(db: DbOrTx, zoneId: string, id: string | null, raw: unknown) {
  const s = parse(slotSchema, raw);
  const values = { zoneId, label: s.label, startTime: s.startTime!, endTime: s.endTime!, cutoffMinutes: s.cutoffMinutes, capacity: s.capacity, daysOfWeek: [...new Set(s.daysOfWeek)].sort(), isActive: s.isActive, sortOrder: s.sortOrder };
  if (id) await db.update(deliverySlots).set(values).where(eq(deliverySlots.id, id));
  else await db.insert(deliverySlots).values(values);
}

export async function deleteSlot(db: DbOrTx, id: string) {
  // Past orders keep their slot label; the reference is cleared.
  await db.delete(deliverySlots).where(eq(deliverySlots.id, id));
}

export async function addBlackout(db: DbOrTx, input: { zoneId: string | null; date: string; reason: string }) {
  if (!isIsoDate(input.date)) throw new ValidationError("Choose a date.", { date: "Required" });
  await db.insert(deliveryBlackouts).values({ zoneId: input.zoneId, date: input.date, reason: input.reason.trim().slice(0, 120) });
}

export async function adminZones(db: DbOrTx) {
  const zones = await db.select().from(deliveryZones).orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.name));
  const pins = await db.select().from(zonePincodes).orderBy(asc(zonePincodes.pincode));
  const slots = await db.select().from(deliverySlots).orderBy(asc(deliverySlots.sortOrder), asc(deliverySlots.startTime));
  const blackouts = await db.select().from(deliveryBlackouts).where(sql`${deliveryBlackouts.date} >= (now() AT TIME ZONE 'Asia/Kolkata')::date`).orderBy(asc(deliveryBlackouts.date));
  return zones.map((z) => ({ zone: z, pincodes: pins.filter((p) => p.zoneId === z.id), slots: slots.filter((s) => s.zoneId === z.id), blackouts: blackouts.filter((b) => b.zoneId === z.id) })).concat([]);
}

export async function globalBlackouts(db: DbOrTx) {
  return db.select().from(deliveryBlackouts).where(sql`${deliveryBlackouts.zoneId} IS NULL AND ${deliveryBlackouts.date} >= (now() AT TIME ZONE 'Asia/Kolkata')::date`).orderBy(asc(deliveryBlackouts.date));
}

// ---------------------------------------------------------------------------
// Coupons
// ---------------------------------------------------------------------------

export const couponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9-]{3,20}$/, "Use 3 to 20 letters, numbers or hyphens"),
    description: z.string().trim().max(160).default(""),
    type: z.enum(["percent", "fixed", "free_delivery"]),
    percent: int(0, 100, 0),
    amount: optionalMoney,
    minOrder: requiredMoney,
    maxDiscount: optionalMoney,
    startsAt: z.string().optional().transform((v) => (v ? new Date(v) : null)),
    endsAt: z.string().optional().transform((v) => (v ? new Date(v) : null)),
    usageLimit: z.string().optional().transform((v) => (v && v.trim() ? Number(v) : null)),
    perPhoneLimit: z.string().optional().transform((v) => (v && v.trim() ? Number(v) : null)),
    isActive: z.boolean().default(true),
  })
  .superRefine((c, ctx) => {
    if (c.type === "percent" && (c.percent < 1 || c.percent > 100)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["percent"], message: "Enter a percentage from 1 to 100" });
    if (c.type === "fixed" && !c.amount) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["amount"], message: "Enter the discount amount" });
    if (c.startsAt && c.endsAt && c.endsAt <= c.startsAt) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["endsAt"], message: "The end must be after the start" });
    for (const k of ["usageLimit", "perPhoneLimit"] as const) {
      const v = c[k];
      if (v !== null && (!Number.isInteger(v) || v < 1)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [k], message: "Enter a whole number or leave empty" });
    }
  });

export async function saveCoupon(db: DbOrTx, id: string | null, raw: unknown) {
  const c = parse(couponSchema, raw);
  const values = {
    code: c.code,
    description: c.description,
    type: c.type,
    value: c.type === "percent" ? c.percent : c.type === "fixed" ? c.amount! : 0,
    minOrderPaise: c.minOrder,
    maxDiscountPaise: c.maxDiscount,
    startsAt: c.startsAt,
    endsAt: c.endsAt,
    usageLimit: c.usageLimit,
    perPhoneLimit: c.perPhoneLimit,
    isActive: c.isActive,
    updatedAt: new Date(),
  };
  try {
    if (id) await db.update(coupons).set(values).where(eq(coupons.id, id));
    else await db.insert(coupons).values(values);
  } catch (e) {
    if (unique(e)) throw new ValidationError("This code already exists.", { code: "Already exists" });
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

const internalOrHttpsHref = z
  .string()
  .trim()
  .max(200)
  .default("")
  .refine((v) => v === "" || /^\/(?!\/)/.test(v) || /^https:\/\//.test(v), "Use a site path like /shop or a full https:// link");

export const bannerSchema = z.object({
  placement: z.enum(["hero", "offer"]),
  eyebrow: z.string().trim().max(60).default(""),
  title: z.string().trim().min(2, "Enter a title").max(120),
  subtitle: z.string().trim().max(300).default(""),
  ctaLabel: z.string().trim().max(40).default(""),
  ctaHref: internalOrHttpsHref,
  imageAlt: z.string().trim().max(200).default(""),
  sortOrder: int(-1000, 1000, 0),
  isActive: z.boolean().default(true),
  startsAt: z.string().optional().transform((v) => (v ? new Date(v) : null)),
  endsAt: z.string().optional().transform((v) => (v ? new Date(v) : null)),
});

export async function saveBanner(db: DbOrTx, id: string | null, raw: unknown, image?: File | null) {
  const b = parse(bannerSchema, raw);
  if (b.ctaLabel && !b.ctaHref) throw new ValidationError("Add a link for the button.", { ctaHref: "Required with a button label" });
  const img = image && image.size > 0 ? await uploadImage(db, image, { alt: b.imageAlt || b.title, nameHint: b.title, minSide: 600 }) : null;
  if (img && !b.imageAlt) throw new ValidationError("Describe the image for people using screen readers.", { imageAlt: "Required with an image" });
  const values = { ...b, updatedAt: new Date(), ...(img ? { imageId: img.id } : {}) };
  if (id) await db.update(banners).set(values).where(eq(banners.id, id));
  else await db.insert(banners).values(values);
}

export const faqSchema = z.object({
  question: z.string().trim().min(5, "Enter the question").max(200),
  answer: z.string().trim().min(5, "Enter the answer").max(2000),
  topic: z.enum(["general", "ordering", "delivery", "payment", "bulk", "product"]),
  categoryId: z.string().optional().transform((v) => (v ? v : null)),
  sortOrder: int(-1000, 1000, 0),
  isPublished: z.boolean().default(true),
});

export async function saveFaq(db: DbOrTx, id: string | null, raw: unknown) {
  const f = parse(faqSchema, raw);
  if (id) await db.update(faqs).set({ ...f, updatedAt: new Date() }).where(eq(faqs.id, id));
  else await db.insert(faqs).values(f);
}

const RESERVED_SLUGS = new Set(["admin", "api", "shop", "category", "collections", "product", "cart", "checkout", "order", "track", "bulk-orders", "delivery", "delivery-areas", "contact", "faq", "guides", "search", "pay", "sitemap.xml", "robots.txt", "llms.txt"]);

export const pageSchema = z.object({
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => SLUG_PATTERN.test(v), "Use lowercase letters, numbers and hyphens")
    .refine((v) => !RESERVED_SLUGS.has(v), "This address is used by another part of the site"),
  title: z.string().trim().min(2, "Enter a title").max(120),
  body: z.string().trim().max(30_000).default(""),
  seoTitle: z.string().trim().max(70).default(""),
  seoDescription: z.string().trim().max(170).default(""),
  isPublished: z.boolean().default(false),
  showInFooter: z.boolean().default(true),
});

export async function savePage(db: DbOrTx, id: string | null, raw: unknown) {
  const p = parse(pageSchema, raw);
  if (p.isPublished && p.body.length < 100) throw new ValidationError("Write the page content before publishing (at least 100 characters).", { body: "Too short to publish" });
  if (p.isPublished && /\[\[confirm:/i.test(p.body)) throw new ValidationError("Replace every [[confirm: ...]] note with your own details before publishing.", { body: "Has details still to confirm" });
  try {
    if (id) await db.update(pages).set({ ...p, updatedAt: new Date() }).where(eq(pages.id, id));
    else await db.insert(pages).values(p);
  } catch (e) {
    if (unique(e)) throw new ValidationError("Another page already uses this address.", { slug: "Already in use" });
    throw e;
  }
}

export const articleSchema = z.object({
  slug: z.string().trim().max(80).optional().default(""),
  title: z.string().trim().min(5, "Enter a title").max(140),
  excerpt: z.string().trim().max(300).default(""),
  body: z.string().trim().max(50_000).default(""),
  coverAlt: z.string().trim().max(200).default(""),
  authorName: z.string().trim().max(80).default("Swastik"),
  relatedCategoryId: z.string().optional().transform((v) => (v ? v : null)),
  status: z.enum(["draft", "published", "archived"]),
  seoTitle: z.string().trim().max(70).default(""),
  seoDescription: z.string().trim().max(170).default(""),
});

export async function saveArticle(db: DbOrTx, id: string | null, raw: unknown, cover?: File | null) {
  const a = parse(articleSchema, raw);
  if (a.status === "published" && a.body.length < 300) throw new ValidationError("Write at least 300 characters before publishing a guide.", { body: "Too short to publish" });
  const slug = a.slug ? slugify(a.slug) : slugify(a.title);
  const img = cover && cover.size > 0 ? await uploadImage(db, cover, { alt: a.coverAlt || a.title, nameHint: slug, minSide: 600 }) : null;
  const existing = id ? (await db.select().from(articles).where(eq(articles.id, id)))[0] : null;
  const values = {
    ...a,
    slug,
    updatedAt: new Date(),
    publishedAt: a.status === "published" ? (existing?.publishedAt ?? new Date()) : (existing?.publishedAt ?? null),
    ...(img ? { coverImageId: img.id } : {}),
  };
  try {
    if (id) await db.update(articles).set(values).where(eq(articles.id, id));
    else await db.insert(articles).values(values);
  } catch (e) {
    if (unique(e)) throw new ValidationError("Another guide already uses this address.", { slug: "Already in use" });
    throw e;
  }
}

export const testimonialSchema = z.object({
  customerName: z.string().trim().min(2, "Enter the customer's name").max(80),
  locality: z.string().trim().max(80).default(""),
  body: z.string().trim().min(10, "Enter the review").max(600),
  rating: z.string().optional().transform((v) => (v ? Number(v) : null)).refine((v) => v === null || (Number.isInteger(v) && v >= 1 && v <= 5), "Choose 1 to 5"),
  receivedOn: z.string().optional().transform((v) => (v ? v : null)),
  isPublished: z.boolean().default(false),
  consentConfirmed: z.boolean(),
  sortOrder: int(-1000, 1000, 0),
});

export async function saveTestimonial(db: DbOrTx, id: string | null, raw: unknown) {
  const t = parse(testimonialSchema, raw);
  if (t.isPublished && !t.consentConfirmed) throw new ValidationError("Confirm this is a genuine review shared with the customer's permission before publishing.", { consentConfirmed: "Required to publish" });
  const { consentConfirmed: _c, ...values } = t;
  if (id) await db.update(testimonials).set(values).where(eq(testimonials.id, id));
  else await db.insert(testimonials).values(values);
}

export const redirectSchema = z.object({
  fromPath: z
    .string()
    .trim()
    .refine((v) => /^\/[^\s?#]*$/.test(v) && !v.startsWith("//") && !v.startsWith("/admin") && !v.startsWith("/api"), "Use a path like /old-page"),
  toPath: internalOrHttpsHref.refine((v) => v !== "", "Enter where to send visitors"),
  permanent: z.boolean().default(true),
});

export async function saveRedirect(db: DbOrTx, raw: unknown) {
  const r = parse(redirectSchema, raw);
  const fromPath = r.fromPath.length > 1 ? r.fromPath.replace(/\/+$/, "") : r.fromPath;
  if (fromPath === r.toPath) throw new ValidationError("A page cannot redirect to itself.", { toPath: "Same as from" });
  await db
    .insert(redirects)
    .values({ fromPath, toPath: r.toPath, permanent: r.permanent })
    .onConflictDoUpdate({ target: redirects.fromPath, set: { toPath: r.toPath, permanent: r.permanent } });
}

export async function listMedia(db: DbOrTx, limit = 60) {
  return db.select().from(media).orderBy(desc(media.createdAt)).limit(limit);
}

export async function listAudit(db: DbOrTx, page = 1) {
  return db
    .select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(100)
    .offset((page - 1) * 100);
}

export async function listMessages(db: DbOrTx) {
  return db.select().from(contactMessages).orderBy(asc(contactMessages.isResolved), desc(contactMessages.createdAt)).limit(200);
}

import { and, asc, desc, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Database, DbOrTx } from "../db/client";
import { bulkEnquiries, bulkEnquiryItems, bulkEnquiryNotes, contactMessages, notifications, orders } from "../db/schema";
import { getEnv } from "../env";
import { NotFoundError, ValidationError } from "../errors";
import { randomReference } from "../crypto";
import { sendEmail } from "../notify";
import { formatDeliveryDate, isIsoDate, todayInIndia } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { normalizeIndianMobile } from "@/lib/phone";
import { fieldErrorsFromZod } from "./orders";
import { getAllSettings } from "./settings";

export const ENQUIRY_STATUS_LABELS = {
  new: "New",
  contacted: "Contacted",
  quoted: "Quotation sent",
  accepted: "Accepted",
  converted: "Converted to order",
  declined: "Declined",
  closed: "Closed",
} as const;

export const FREQUENCY_LABELS = {
  one_time: "One-time",
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
  festival_season: "For a festival or season",
  other: "Other",
} as const;

export const BULK_UNITS = ["kg", "pieces", "bunches", "bundles", "garlands", "strings", "packs", "baskets"] as const;

const phoneField = z.string().transform((v, ctx) => {
  const n = normalizeIndianMobile(v);
  if (!n) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid 10-digit mobile number" });
  return n ?? "";
});

const optionalEmail = z
  .string()
  .trim()
  .max(120)
  .optional()
  .transform((v) => v || null)
  .refine((v) => v === null || z.string().email().safeParse(v).success, "Enter a valid email address");

export const bulkEnquirySchema = z.object({
  institutionName: z.string().trim().min(2, "Enter the mandir, institution or customer name").max(120),
  contactName: z.string().trim().min(2, "Enter the contact person's name").max(80),
  phone: phoneField,
  email: optionalEmail,
  address: z.string().trim().min(5, "Enter the delivery address").max(300),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
  deliveryDate: z.string().refine(isIsoDate, "Choose the date you need the flowers"),
  preferredTime: z.string().trim().max(60).optional().default(""),
  frequency: z.enum(["one_time", "daily", "weekly", "monthly", "festival_season", "other"]),
  recurringDetails: z.string().trim().max(300).optional().default(""),
  instructions: z.string().trim().max(1000).optional().default(""),
  items: z
    .array(
      z.object({
        flower: z.string().trim().min(2, "Enter the flower variety").max(80),
        quantity: z.coerce.number().positive("Enter a quantity").max(100000, "Quantity is too large"),
        unit: z.enum(BULK_UNITS),
        notes: z.string().trim().max(200).optional().default(""),
      }),
    )
    .min(1, "Add at least one flower variety")
    .max(30, "Add up to 30 varieties in one enquiry"),
  // Honeypot and minimum fill time (spam protection without third-party captchas).
  website: z.string().max(0, "Invalid submission").optional().default(""),
  startedAt: z.coerce.number().int().optional(),
});

export type BulkEnquiryInput = z.input<typeof bulkEnquirySchema>;

/** Forms submitted faster than this are almost always automated. */
const MIN_FILL_MS = 3000;

export async function submitBulkEnquiry(db: Database, raw: unknown, opts: { now?: Date } = {}) {
  const parsed = bulkEnquirySchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Please check the highlighted details.", fieldErrorsFromZod(parsed.error));
  const input = parsed.data;
  const now = opts.now ?? new Date();
  if (input.startedAt && now.getTime() - input.startedAt < MIN_FILL_MS) throw new ValidationError("Please take a moment to check your enquiry and submit again.");
  if (input.deliveryDate < todayInIndia(now)) throw new ValidationError("The required date is in the past.", { deliveryDate: "Choose a future date" });

  const enquiry = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(bulkEnquiries)
      .values({
        reference: randomReference("BQ", 6),
        institutionName: input.institutionName,
        contactName: input.contactName,
        phone: input.phone,
        email: input.email,
        address: input.address,
        pincode: input.pincode,
        deliveryDate: input.deliveryDate,
        preferredTime: input.preferredTime,
        frequency: input.frequency,
        recurringDetails: input.recurringDetails,
        instructions: input.instructions,
      })
      .returning();
    await tx.insert(bulkEnquiryItems).values(input.items.map((i, idx) => ({ enquiryId: row.id, flower: i.flower, quantity: String(i.quantity), unit: i.unit, notes: i.notes, sortOrder: idx })));
    return row;
  });
  return { id: enquiry.id, reference: enquiry.reference, input };
}

export async function notifyBulkEnquiry(db: DbOrTx, enquiryId: string): Promise<void> {
  const [e] = await db.select().from(bulkEnquiries).where(eq(bulkEnquiries.id, enquiryId));
  if (!e) return;
  const items = await db.select().from(bulkEnquiryItems).where(eq(bulkEnquiryItems.enquiryId, enquiryId)).orderBy(asc(bulkEnquiryItems.sortOrder));
  const { business, notifications: prefs } = await getAllSettings(db, ["business", "notifications"]);
  const list = items.map((i) => `- ${i.flower}: ${Number(i.quantity)} ${i.unit}${i.notes ? ` (${i.notes})` : ""}`).join("\n");
  const details = `Reference: ${e.reference}\nFor: ${e.institutionName}\nRequired on: ${formatDeliveryDate(e.deliveryDate, { withYear: true })}${e.preferredTime ? `, ${e.preferredTime}` : ""}\nRequirement: ${FREQUENCY_LABELS[e.frequency]}${e.recurringDetails ? ` (${e.recurringDetails})` : ""}\n\n${list}`;
  if (prefs.emailOwnerOnBulkEnquiry && business.notificationEmail) {
    await sendEmail(db, {
      to: business.notificationEmail,
      subject: `Bulk enquiry ${e.reference} from ${e.institutionName}`,
      body: `${details}\n\nContact: ${e.contactName}, ${e.phone}${e.email ? `, ${e.email}` : ""}\nAddress: ${e.address} ${e.pincode}\n${e.instructions ? `\nInstructions: ${e.instructions}\n` : ""}\nOpen in admin: ${getEnv().APP_URL}/admin/bulk-enquiries/${e.id}`,
      template: "owner_bulk_enquiry",
      enquiryId: e.id,
    });
  }
  if (e.email && prefs.emailCustomers) {
    await sendEmail(db, {
      to: e.email,
      subject: `We received your bulk enquiry ${e.reference}`,
      body: `Namaskar ${e.contactName},\n\nThank you for your enquiry. We will review availability and pricing and contact you on ${e.phone}. This is not yet a confirmed order.\n\n${details}\n\n${business.name}${business.phone ? `\nPhone: ${business.phone}` : ""}`,
      template: "bulk_enquiry_received",
      enquiryId: e.id,
    });
  }
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export type EnquiryStatus = keyof typeof ENQUIRY_STATUS_LABELS;

export async function listEnquiries(db: DbOrTx, f: { status?: EnquiryStatus | ""; q?: string; page?: number }) {
  const c: SQL[] = [];
  if (f.status) c.push(eq(bulkEnquiries.status, f.status));
  const q = f.q?.trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    c.push(or(ilike(bulkEnquiries.reference, like), ilike(bulkEnquiries.institutionName, like), ilike(bulkEnquiries.contactName, like), ilike(bulkEnquiries.phone, like), ilike(bulkEnquiries.pincode, like))!);
  }
  const where = c.length ? and(...c) : undefined;
  const page = Math.max(1, f.page ?? 1);
  const [rows, [{ n }]] = await Promise.all([
    db
      .select({
        e: bulkEnquiries,
        itemCount: sql<number>`(SELECT count(*)::int FROM bulk_enquiry_items i WHERE i.enquiry_id = ${bulkEnquiries.id})`,
      })
      .from(bulkEnquiries)
      .where(where)
      .orderBy(desc(bulkEnquiries.createdAt))
      .limit(25)
      .offset((page - 1) * 25),
    db.select({ n: sql<number>`count(*)::int` }).from(bulkEnquiries).where(where),
  ]);
  return { rows, total: n, page };
}

export async function getEnquiry(db: DbOrTx, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [e] = await db.select().from(bulkEnquiries).where(eq(bulkEnquiries.id, id));
  if (!e) return null;
  const [items, notes, sent, order] = await Promise.all([
    db.select().from(bulkEnquiryItems).where(eq(bulkEnquiryItems.enquiryId, id)).orderBy(asc(bulkEnquiryItems.sortOrder)),
    db.select().from(bulkEnquiryNotes).where(eq(bulkEnquiryNotes.enquiryId, id)).orderBy(desc(bulkEnquiryNotes.createdAt)),
    db.select().from(notifications).where(eq(notifications.enquiryId, id)).orderBy(desc(notifications.createdAt)),
    e.convertedOrderId ? db.select({ id: orders.id, orderNumber: orders.orderNumber, status: orders.status }).from(orders).where(eq(orders.id, e.convertedOrderId)) : Promise.resolve([]),
  ]);
  return { enquiry: e, items, notes, notifications: sent, order: order[0] ?? null };
}

export async function updateEnquiry(
  db: Database,
  id: string,
  input: { status: EnquiryStatus; note?: string; noteKind?: "note" | "quotation" | "follow_up"; quotedAmountPaise?: number | null; nextFollowUpAt?: Date | null },
): Promise<void> {
  await db.transaction(async (tx) => {
    const [e] = await tx.select().from(bulkEnquiries).where(eq(bulkEnquiries.id, id));
    if (!e) throw new NotFoundError("Enquiry not found");
    const patch: Partial<typeof bulkEnquiries.$inferInsert> = { status: input.status, updatedAt: new Date() };
    if (input.quotedAmountPaise !== undefined) patch.quotedAmountPaise = input.quotedAmountPaise;
    if (input.nextFollowUpAt !== undefined) patch.nextFollowUpAt = input.nextFollowUpAt;
    await tx.update(bulkEnquiries).set(patch).where(eq(bulkEnquiries.id, id));
    if (e.status !== input.status) await tx.insert(bulkEnquiryNotes).values({ enquiryId: id, kind: "status", body: `Status changed from ${ENQUIRY_STATUS_LABELS[e.status]} to ${ENQUIRY_STATUS_LABELS[input.status]}.` });
    if (input.quotedAmountPaise !== undefined && input.quotedAmountPaise !== e.quotedAmountPaise && input.quotedAmountPaise !== null) {
      await tx.insert(bulkEnquiryNotes).values({ enquiryId: id, kind: "quotation", body: `Quotation amount set to ${formatINR(input.quotedAmountPaise)}.` });
    }
    if (input.note?.trim()) await tx.insert(bulkEnquiryNotes).values({ enquiryId: id, kind: input.noteKind ?? "note", body: input.note.trim().slice(0, 2000) });
  });
}

export async function linkEnquiryOrder(db: DbOrTx, enquiryId: string, orderId: string) {
  await db.update(bulkEnquiries).set({ status: "converted", convertedOrderId: orderId, updatedAt: new Date() }).where(eq(bulkEnquiries.id, enquiryId));
  await db.insert(bulkEnquiryNotes).values({ enquiryId, kind: "status", body: "Converted to an order." });
}

// ---------------------------------------------------------------------------
// Contact form
// ---------------------------------------------------------------------------

export const contactSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  phone: phoneField,
  email: optionalEmail,
  orderNumber: z.string().trim().max(20).optional().default(""),
  message: z.string().trim().min(5, "Write your message").max(2000),
  website: z.string().max(0, "Invalid submission").optional().default(""),
  startedAt: z.coerce.number().int().optional(),
});

export async function submitContact(db: DbOrTx, raw: unknown, now = new Date()) {
  const parsed = contactSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Please check the highlighted details.", fieldErrorsFromZod(parsed.error));
  const input = parsed.data;
  if (input.startedAt && now.getTime() - input.startedAt < MIN_FILL_MS) throw new ValidationError("Please take a moment to check your message and send again.");
  const [row] = await db
    .insert(contactMessages)
    .values({ name: input.name, phone: input.phone, email: input.email, orderNumber: input.orderNumber || null, message: input.message })
    .returning();
  const { business } = await getAllSettings(db, ["business"]);
  if (business.notificationEmail) {
    await sendEmail(db, {
      to: business.notificationEmail,
      subject: `Website message from ${input.name}`,
      body: `${input.message}\n\nFrom: ${input.name}, ${input.phone}${input.email ? `, ${input.email}` : ""}${input.orderNumber ? `\nOrder: ${input.orderNumber}` : ""}\n\nOpen in admin: ${getEnv().APP_URL}/admin/messages`,
      template: "owner_contact_message",
    });
  }
  return row;
}

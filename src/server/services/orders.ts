import { createHmac } from "node:crypto";
import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Database, DbOrTx } from "../db/client";
import { couponRedemptions, coupons, notifications, orderEvents, orderItems, orders, payments, productVariants, refunds, stockMovements } from "../db/schema";
import { getEnv } from "../env";
import { AppError, ConflictError, NotFoundError, ValidationError } from "../errors";
import { randomReference, safeEqual } from "../crypto";
import { sendEmail } from "../notify";
import { gateway } from "../payments";
import { formatINR } from "@/lib/money";
import { formatDeliveryDate } from "@/lib/dates";
import { normalizeIndianMobile } from "@/lib/phone";
import { slotLabel, validateDeliveryChoice } from "./delivery";
import { cartLinesSchema, quoteCart } from "./pricing";
import { getAllSettings } from "./settings";

export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type OrderStatus = Order["status"];
export type PaymentStatus = Order["paymentStatus"];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: "Pending payment",
  pending_confirmation: "Pending confirmation",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready_for_dispatch: "Ready for dispatch",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: "Not paid",
  pending: "Payment pending",
  paid: "Paid",
  failed: "Payment failed",
  refund_pending: "Refund pending",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
};

/** Fulfilment steps the owner can move an order to from each status. */
export const NEXT_STATUSES: Record<OrderStatus, OrderStatus[]> = {
  pending_payment: ["cancelled"],
  pending_confirmation: ["confirmed", "cancelled"],
  confirmed: ["preparing", "ready_for_dispatch", "out_for_delivery", "delivered", "cancelled"],
  preparing: ["ready_for_dispatch", "out_for_delivery", "delivered", "cancelled"],
  ready_for_dispatch: ["out_for_delivery", "delivered", "cancelled"],
  out_for_delivery: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

// ---------------------------------------------------------------------------
// Customer access to an order
// ---------------------------------------------------------------------------

/**
 * The order link carries a token derived from the order id with AUTH_SECRET. It
 * cannot be guessed from the order number, and nothing secret is stored.
 */
export function orderAccessToken(orderId: string): string {
  return createHmac("sha256", getEnv().AUTH_SECRET).update(`order-access:${orderId}`).digest("base64url").slice(0, 32);
}

export function orderLink(order: Pick<Order, "id" | "orderNumber">): string {
  return `/order/${order.orderNumber}?t=${orderAccessToken(order.id)}`;
}

export async function getOrderByAccess(db: DbOrTx, orderNumber: string, token: string | undefined | null) {
  if (!token || !/^SW-[A-Z0-9]{8}$/.test(orderNumber)) return null;
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  if (!order || !safeEqual(token, orderAccessToken(order.id))) return null;
  const [items, events] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(asc(orderItems.productName)),
    db
      .select()
      .from(orderEvents)
      .where(and(eq(orderEvents.orderId, order.id), eq(orderEvents.isInternal, false)))
      .orderBy(asc(orderEvents.createdAt)),
  ]);
  return { order, items, events };
}

/**
 * Tracking by order number and the phone number used at checkout. Returns status
 * information only: no address, phone or payment details.
 */
export async function trackOrder(db: DbOrTx, orderNumber: string, phoneInput: string) {
  const phone = normalizeIndianMobile(phoneInput);
  const number = orderNumber.trim().toUpperCase();
  if (!phone || !/^SW-[A-Z0-9]{8}$/.test(number)) return null;
  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.orderNumber, number), eq(orders.phone, phone)))
    .limit(1);
  if (!order) return null;
  const [items, events] = await Promise.all([
    db.select({ productName: orderItems.productName, variantLabel: orderItems.variantLabel, unitLabel: orderItems.unitLabel, quantity: orderItems.quantity }).from(orderItems).where(eq(orderItems.orderId, order.id)),
    db
      .select({ toStatus: orderEvents.toStatus, message: orderEvents.message, createdAt: orderEvents.createdAt, type: orderEvents.type })
      .from(orderEvents)
      .where(and(eq(orderEvents.orderId, order.id), eq(orderEvents.isInternal, false)))
      .orderBy(asc(orderEvents.createdAt)),
  ]);
  return {
    orderNumber: order.orderNumber,
    status: order.status,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    deliveryDate: order.deliveryDate,
    slotLabel: order.slotLabel,
    zoneName: order.zoneName,
    totalPaise: order.totalPaise,
    createdAt: order.createdAt,
    items,
    events,
  };
}

// ---------------------------------------------------------------------------
// Placing an order
// ---------------------------------------------------------------------------

const trimmed = (max: number) => z.string().trim().max(max);

export const checkoutInputSchema = z.object({
  idempotencyKey: z.string().uuid(),
  lines: cartLinesSchema.min(1, "Your cart is empty"),
  customerName: trimmed(80).min(2, "Enter your name"),
  phone: z.string().transform((v, ctx) => {
    const n = normalizeIndianMobile(v);
    if (!n) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid 10-digit mobile number" });
    return n ?? "";
  }),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || null)
    .refine((v) => v === null || z.string().email().safeParse(v).success, "Enter a valid email address"),
  addressLine1: trimmed(160).min(5, "Enter your house or flat number and street"),
  addressLine2: trimmed(160).optional().default(""),
  landmark: trimmed(120).optional().default(""),
  locality: trimmed(80).min(2, "Enter your locality"),
  city: trimmed(80).min(2, "Enter your town or city"),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a delivery date"),
  slotId: z.string().uuid().nullable().optional(),
  notes: trimmed(500).optional().default(""),
  paymentMethod: z.enum(["online", "cod"]),
  couponCode: trimmed(40).optional().default(""),
  whatsappConsent: z.boolean().optional().default(false),
  // The total the customer saw. If the server total differs, the order is not placed and the customer reviews it.
  expectedTotalPaise: z.number().int().min(0),
  // Honeypot field, left empty by people.
  website: z.string().max(0, "Invalid submission").optional().default(""),
});

export type CheckoutInput = z.input<typeof checkoutInputSchema>;

export interface PlacedOrder {
  orderId: string;
  orderNumber: string;
  accessToken: string;
  status: OrderStatus;
  paymentMethod: "online" | "cod";
  totalPaise: number;
  replayed: boolean;
}

export function fieldErrorsFromZod(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    out[key] ??= issue.message;
  }
  return out;
}

export async function paymentOptions(db: DbOrTx) {
  const { checkout } = await getAllSettings(db, ["checkout"]);
  const gw = gateway();
  return {
    online: checkout.onlinePaymentsEnabled && !!gw,
    onlineIsTest: gw?.isTest ?? false,
    cod: checkout.codEnabled,
    codMaxOrderPaise: checkout.codMaxOrderPaise,
    acceptingOrders: checkout.acceptingOrders,
    pausedMessage: checkout.pausedMessage,
  };
}

export async function placeOrder(db: Database, raw: unknown, opts: { now?: Date } = {}): Promise<PlacedOrder> {
  const parsed = checkoutInputSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Please check the highlighted details.", fieldErrorsFromZod(parsed.error));
  const input = parsed.data;
  const now = opts.now ?? new Date();

  const existing = await db.select().from(orders).where(eq(orders.idempotencyKey, input.idempotencyKey)).limit(1);
  if (existing[0]) return placedFrom(existing[0], true);

  const options = await paymentOptions(db);
  if (!options.acceptingOrders) throw new AppError(options.pausedMessage);
  if (input.paymentMethod === "online" && !options.online) throw new ValidationError("Online payment is not available right now.", { paymentMethod: "Not available" });
  if (input.paymentMethod === "cod" && !options.cod) throw new ValidationError("Cash on Delivery is not available.", { paymentMethod: "Not available" });

  // Expire stale unpaid orders first so their reserved stock is available again.
  await expireUnpaidOrders(db, now);
  const { checkout } = await getAllSettings(db, ["checkout"]);

  try {
    const order = await db.transaction(async (tx) => {
      const quote = await quoteCart(tx, { lines: input.lines, pincode: input.pincode, couponCode: input.couponCode, phone: input.phone }, { lock: true, now });
      if (quote.missingVariantIds.length) throw new ConflictError("Some items in your cart are no longer available. Please review your cart.");
      const bad = quote.lines.find((l) => l.issue);
      if (bad) throw new ConflictError(`${bad.name}${bad.variantLabel ? ` (${bad.variantLabel})` : ""}: ${bad.issue}. Please update your cart.`);
      if (input.couponCode && quote.couponError) throw new ValidationError(quote.couponError, { couponCode: quote.couponError });
      if (!quote.delivery?.serviceable) throw new ValidationError("We do not deliver to this PIN code yet.", { pincode: "Not in our delivery area" });
      if (!quote.canCheckout) throw new ValidationError(quote.issues[0] ?? "Your order cannot be placed.");

      const { zone, slot } = await validateDeliveryChoice(tx, { pincode: input.pincode, date: input.deliveryDate, slotId: input.slotId }, now);
      if (input.paymentMethod === "cod" && options.codMaxOrderPaise !== null && quote.totalPaise > options.codMaxOrderPaise) {
        throw new ValidationError(`Cash on Delivery is available for orders up to ${formatINR(options.codMaxOrderPaise)}.`, { paymentMethod: "Order too large for COD" });
      }
      if (quote.totalPaise !== input.expectedTotalPaise) {
        throw new ConflictError(`Your order total has changed to ${formatINR(quote.totalPaise)}. Please review the updated total and place the order again.`);
      }

      const online = input.paymentMethod === "online";
      const [created] = await tx
        .insert(orders)
        .values({
          orderNumber: randomReference("SW"),
          idempotencyKey: input.idempotencyKey,
          status: online ? "pending_payment" : "pending_confirmation",
          paymentStatus: online ? "pending" : "unpaid",
          paymentMethod: input.paymentMethod,
          customerName: input.customerName,
          phone: input.phone,
          email: input.email,
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2,
          landmark: input.landmark,
          locality: input.locality,
          city: input.city,
          pincode: input.pincode,
          zoneId: zone.id,
          zoneName: zone.name,
          deliveryDate: input.deliveryDate,
          slotId: slot?.id ?? null,
          slotLabel: slot ? slotLabel(slot) : "",
          customerNotes: input.notes,
          subtotalPaise: quote.itemsSubtotalPaise,
          discountPaise: quote.discountPaise,
          deliveryFeePaise: quote.deliveryFeePaise,
          totalPaise: quote.totalPaise,
          couponId: quote.coupon?.id ?? null,
          couponCode: quote.coupon?.code ?? null,
          whatsappConsent: input.whatsappConsent,
          paymentExpiresAt: online ? new Date(now.getTime() + checkout.paymentWindowMinutes * 60_000) : null,
        })
        .returning();

      await tx.insert(orderItems).values(
        quote.lines.map((l) => ({
          orderId: created.id,
          productId: l.productId,
          variantId: l.variantId,
          productName: l.name,
          variantLabel: l.variantLabel,
          sku: l.sku,
          unitLabel: l.unitLabel,
          imageId: l.imageId,
          unitPricePaise: l.unitPricePaise,
          quantity: l.quantity,
          lineTotalPaise: l.lineTotalPaise,
          stockReserved: l.trackInventory,
        })),
      );
      // Reserve stock (the variant rows are locked by quoteCart).
      for (const l of quote.lines.filter((x) => x.trackInventory)) {
        const updated = await tx
          .update(productVariants)
          .set({ stockQuantity: sql`${productVariants.stockQuantity} - ${l.quantity}`, updatedAt: now })
          .where(and(eq(productVariants.id, l.variantId), gte(productVariants.stockQuantity, l.quantity)))
          .returning({ id: productVariants.id });
        if (!updated.length) throw new ConflictError(`${l.name} has just sold out. Please update your cart.`);
        await tx.insert(stockMovements).values({ variantId: l.variantId, delta: -l.quantity, reason: "order_placed", orderId: created.id });
      }
      if (quote.coupon) {
        await tx.insert(couponRedemptions).values({ couponId: quote.coupon.id, orderId: created.id, phone: input.phone });
        await tx.update(coupons).set({ usedCount: sql`${coupons.usedCount} + 1` }).where(eq(coupons.id, quote.coupon.id));
      }
      await tx.insert(orderEvents).values({
        orderId: created.id,
        type: "created",
        toStatus: created.status,
        message: online ? "Order placed. Waiting for online payment." : "Order placed with Cash on Delivery. Waiting for confirmation.",
        isInternal: false,
        actor: "customer",
      });
      return created;
    });
    return placedFrom(order, false);
  } catch (e) {
    // A concurrent retry with the same idempotency key won the race: return that order.
    if ((e as { code?: string }).code === "23505" && String((e as { constraint?: string }).constraint ?? "").includes("idempotency")) {
      const [again] = await db.select().from(orders).where(eq(orders.idempotencyKey, input.idempotencyKey)).limit(1);
      if (again) return placedFrom(again, true);
    }
    throw e;
  }
}

function placedFrom(order: Order, replayed: boolean): PlacedOrder {
  return {
    orderId: order.id,
    orderNumber: order.orderNumber,
    accessToken: orderAccessToken(order.id),
    status: order.status,
    paymentMethod: order.paymentMethod,
    totalPaise: order.totalPaise,
    replayed,
  };
}

// ---------------------------------------------------------------------------
// Stock release and expiry
// ---------------------------------------------------------------------------

/** Returns reserved stock for an order's items. Safe to call more than once. */
export async function releaseStock(tx: DbOrTx, orderId: string, reason: string): Promise<void> {
  const reserved = await tx
    .update(orderItems)
    .set({ stockReserved: false })
    .where(and(eq(orderItems.orderId, orderId), eq(orderItems.stockReserved, true)))
    .returning({ variantId: orderItems.variantId, quantity: orderItems.quantity });
  for (const r of reserved) {
    if (!r.variantId) continue;
    await tx
      .update(productVariants)
      .set({ stockQuantity: sql`${productVariants.stockQuantity} + ${r.quantity}`, updatedAt: new Date() })
      .where(eq(productVariants.id, r.variantId));
    await tx.insert(stockMovements).values({ variantId: r.variantId, delta: r.quantity, reason, orderId });
  }
}

async function releaseCoupon(tx: DbOrTx, orderId: string): Promise<void> {
  const removed = await tx.delete(couponRedemptions).where(eq(couponRedemptions.orderId, orderId)).returning({ couponId: couponRedemptions.couponId });
  for (const r of removed) await tx.update(coupons).set({ usedCount: sql`GREATEST(${coupons.usedCount} - 1, 0)` }).where(eq(coupons.id, r.couponId));
}

/** Cancels online orders whose payment window has passed without a captured payment. */
export async function expireUnpaidOrders(db: Database, now = new Date()): Promise<number> {
  const stale = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.status, "pending_payment"), lte(orders.paymentExpiresAt, now)))
    .limit(100);
  let count = 0;
  for (const { id } of stale) {
    const done = await db.transaction(async (tx) => {
      const locked = await tx.execute<{ status: string; payment_status: string }>(sql`SELECT status, payment_status FROM orders WHERE id = ${id} FOR UPDATE`);
      const row = locked.rows[0];
      if (!row || row.status !== "pending_payment" || row.payment_status === "paid") return false;
      await tx
        .update(orders)
        .set({ status: "cancelled", paymentStatus: row.payment_status === "failed" ? "failed" : "unpaid", cancelReason: "Payment was not completed in time", cancelledAt: now, updatedAt: now })
        .where(eq(orders.id, id));
      await tx.update(payments).set({ status: "expired", updatedAt: now }).where(and(eq(payments.orderId, id), eq(payments.status, "created")));
      await releaseStock(tx, id, "order_released");
      await releaseCoupon(tx, id);
      await tx.insert(orderEvents).values({ orderId: id, type: "status", fromStatus: "pending_payment", toStatus: "cancelled", message: "Cancelled because payment was not completed in time.", isInternal: false });
      return true;
    });
    if (done) count++;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

function itemsText(items: Pick<OrderItem, "productName" | "variantLabel" | "quantity" | "unitLabel" | "lineTotalPaise">[]): string {
  return items.map((i) => `- ${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ""}: ${i.quantity} × ${i.unitLabel} = ${formatINR(i.lineTotalPaise)}`).join("\n");
}

export async function notifyOrder(db: DbOrTx, orderId: string, event: "placed" | "paid" | "payment_failed" | "status" | "cancelled" | "refund"): Promise<void> {
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) return;
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
  const { business, notifications: prefs } = await getAllSettings(db, ["business", "notifications"]);
  const env = getEnv();
  const link = `${env.APP_URL}${orderLink(order)}`;
  const delivery = `${formatDeliveryDate(order.deliveryDate, { withYear: true })}${order.slotLabel ? `, ${order.slotLabel}` : ""}`;
  const summary = `${itemsText(items)}\n\nItems: ${formatINR(order.subtotalPaise)}${order.discountPaise ? `\nDiscount: -${formatINR(order.discountPaise)}` : ""}\nDelivery: ${order.deliveryFeePaise ? formatINR(order.deliveryFeePaise) : "Free"}\nTotal: ${formatINR(order.totalPaise)}`;
  const contact = [business.phone && `Phone: ${business.phone}`, business.whatsapp && `WhatsApp: ${business.whatsapp}`, business.email && `Email: ${business.email}`].filter(Boolean).join("\n");
  const sign = `\n\n${business.name}${contact ? `\n${contact}` : ""}`;

  const toCustomer = async (template: string, subject: string, body: string) => {
    if (!order.email || !prefs.emailCustomers) return;
    await sendEmail(db, { to: order.email, subject, body: `Namaskar ${order.customerName},\n\n${body}\n\nView your order: ${link}${sign}`, template, orderId });
  };

  if (event === "placed") {
    // COD orders are announced when placed; online orders once the payment is captured.
    if (order.paymentMethod === "cod") {
      await toCustomer("order_received", `Order ${order.orderNumber} received`, `We have received your order ${order.orderNumber}. We will confirm it shortly.\n\nDelivery: ${delivery}\nPayment: Cash on Delivery\n\n${summary}`);
      await notifyOwnerNewOrder(db, order, items, prefs.emailOwnerOnNewOrder ? business.notificationEmail : "");
    }
    return;
  }
  if (event === "paid") {
    await toCustomer("payment_successful", `Payment received for order ${order.orderNumber}`, `We have received your payment of ${formatINR(order.totalPaise)} for order ${order.orderNumber}. We will confirm your order shortly.\n\nDelivery: ${delivery}\n\n${summary}`);
    await notifyOwnerNewOrder(db, order, items, prefs.emailOwnerOnNewOrder ? business.notificationEmail : "");
    return;
  }
  if (event === "payment_failed") {
    await toCustomer("payment_failed", `Payment not completed for order ${order.orderNumber}`, `Your payment for order ${order.orderNumber} did not go through. No money has been taken by us for this attempt. You can try again from your order page before the order expires.`);
    return;
  }
  if (event === "cancelled") {
    await toCustomer("order_cancelled", `Order ${order.orderNumber} cancelled`, `Your order ${order.orderNumber} has been cancelled.${order.cancelReason ? `\nReason: ${order.cancelReason}` : ""}${order.paymentStatus === "refund_pending" ? "\nYour refund will be processed and we will let you know when it is done." : ""}`);
    return;
  }
  if (event === "refund") {
    await toCustomer("refund_update", `Refund update for order ${order.orderNumber}`, `Refunded so far: ${formatINR(order.refundedPaise)} of ${formatINR(order.totalPaise)}.\nBank and UPI refunds usually take a few working days to reach your account.`);
    return;
  }
  const messages: Partial<Record<OrderStatus, string>> = {
    confirmed: `Your order ${order.orderNumber} is confirmed for delivery on ${delivery}.`,
    out_for_delivery: `Your order ${order.orderNumber} is out for delivery.`,
    delivered: `Your order ${order.orderNumber} has been delivered. Thank you for ordering from ${business.name}.`,
  };
  const msg = messages[order.status];
  if (msg) await toCustomer(`order_${order.status}`, `Order ${order.orderNumber}: ${ORDER_STATUS_LABELS[order.status]}`, msg);
}

async function notifyOwnerNewOrder(db: DbOrTx, order: Order, items: OrderItem[], to: string) {
  if (!to) return;
  const env = getEnv();
  await sendEmail(db, {
    to,
    subject: `New order ${order.orderNumber}: ${formatINR(order.totalPaise)} (${order.paymentMethod === "cod" ? "Cash on Delivery" : "Paid online"})`,
    body: `New order ${order.orderNumber}\n\nCustomer: ${order.customerName}, ${order.phone}\nDeliver to: ${order.addressLine1}, ${order.locality}, ${order.city} ${order.pincode}\nDelivery: ${formatDeliveryDate(order.deliveryDate, { withYear: true })}${order.slotLabel ? `, ${order.slotLabel}` : ""}\n\n${itemsText(items)}\n\nTotal: ${formatINR(order.totalPaise)}\n\nOpen in admin: ${env.APP_URL}/admin/orders/${order.id}`,
    template: "owner_new_order",
    orderId: order.id,
  });
}

// ---------------------------------------------------------------------------
// Administration
// ---------------------------------------------------------------------------

export interface OrderFilters {
  q?: string;
  status?: OrderStatus | "active" | "";
  paymentStatus?: PaymentStatus | "";
  from?: string;
  to?: string;
  dateField?: "created" | "delivery";
  page?: number;
  pageSize?: number;
}

function orderWhere(f: OrderFilters): SQL | undefined {
  const c: SQL[] = [];
  if (f.status === "active") c.push(inArray(orders.status, ["pending_confirmation", "confirmed", "preparing", "ready_for_dispatch", "out_for_delivery"]));
  else if (f.status) c.push(eq(orders.status, f.status));
  if (f.paymentStatus) c.push(eq(orders.paymentStatus, f.paymentStatus));
  const field = f.dateField === "delivery" ? sql`${orders.deliveryDate}` : sql`(${orders.createdAt} AT TIME ZONE 'Asia/Kolkata')::date`;
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) c.push(sql`${field} >= ${f.from}`);
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) c.push(sql`${field} <= ${f.to}`);
  const q = f.q?.trim();
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    const digits = q.replace(/\D/g, "");
    c.push(or(ilike(orders.orderNumber, like), ilike(orders.customerName, like), ilike(orders.email, like), ilike(orders.pincode, like), digits.length >= 4 ? ilike(orders.phone, `%${digits.slice(-10)}%`) : sql`false`)!);
  }
  return c.length ? and(...c) : undefined;
}

export async function listOrders(db: DbOrTx, f: OrderFilters) {
  const pageSize = f.pageSize ?? 25;
  const page = Math.max(1, f.page ?? 1);
  const where = orderWhere(f);
  const [rows, [{ n }]] = await Promise.all([
    db
      .select()
      .from(orders)
      .where(where)
      .orderBy(desc(orders.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(where),
  ]);
  return { rows, total: n, page, pageSize };
}

export async function exportOrders(db: DbOrTx, f: OrderFilters) {
  const where = orderWhere(f);
  const rows = await db.select().from(orders).where(where).orderBy(desc(orders.createdAt)).limit(10_000);
  const items = rows.length ? await db.select().from(orderItems).where(inArray(orderItems.orderId, rows.map((r) => r.id))) : [];
  return rows.map((o) => ({ order: o, items: items.filter((i) => i.orderId === o.id) }));
}

export async function getOrderForAdmin(db: DbOrTx, id: string) {
  if (!z.string().uuid().safeParse(id).success) return null;
  const [order] = await db.select().from(orders).where(eq(orders.id, id)).limit(1);
  if (!order) return null;
  const [items, events, pays, refs, notes] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, id)),
    db.select().from(orderEvents).where(eq(orderEvents.orderId, id)).orderBy(desc(orderEvents.createdAt)),
    db.select().from(payments).where(eq(payments.orderId, id)).orderBy(desc(payments.createdAt)),
    db.select().from(refunds).where(eq(refunds.orderId, id)).orderBy(desc(refunds.createdAt)),
    db.select().from(notifications).where(eq(notifications.orderId, id)).orderBy(desc(notifications.createdAt)),
  ]);
  return { order, items, events, payments: pays, refunds: refs, notifications: notes };
}

async function lockOrder(tx: DbOrTx, id: string): Promise<Order> {
  await tx.execute(sql`SELECT id FROM orders WHERE id = ${id} FOR UPDATE`);
  const [order] = await tx.select().from(orders).where(eq(orders.id, id));
  if (!order) throw new NotFoundError("Order not found");
  return order;
}

export async function updateOrderStatus(db: Database, id: string, to: OrderStatus, actor: string, opts: { note?: string; cancelReason?: string } = {}): Promise<Order> {
  const updated = await db.transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    if (order.status === to) return order;
    if (!NEXT_STATUSES[order.status].includes(to)) throw new ValidationError(`An order that is ${ORDER_STATUS_LABELS[order.status].toLowerCase()} cannot be moved to ${ORDER_STATUS_LABELS[to].toLowerCase()}.`);
    if (to === "cancelled" && !opts.cancelReason?.trim()) throw new ValidationError("Enter a reason for cancelling.", { cancelReason: "Required" });
    const now = new Date();
    const patch: Partial<Order> = { status: to, updatedAt: now };
    if (to === "confirmed") patch.confirmedAt = now;
    if (to === "delivered") patch.deliveredAt = now;
    if (to === "cancelled") {
      patch.cancelledAt = now;
      patch.cancelReason = opts.cancelReason!.trim().slice(0, 300);
      if (order.paymentStatus === "paid" || order.paymentStatus === "partially_refunded") patch.paymentStatus = "refund_pending";
      if (order.status !== "delivered") await releaseStock(tx, id, "order_released");
      await releaseCoupon(tx, id);
    }
    const [row] = await tx.update(orders).set(patch).where(eq(orders.id, id)).returning();
    await tx.insert(orderEvents).values({
      orderId: id,
      type: "status",
      fromStatus: order.status,
      toStatus: to,
      message: to === "cancelled" ? `Cancelled: ${patch.cancelReason}` : opts.note?.trim() || `Status changed to ${ORDER_STATUS_LABELS[to]}.`,
      isInternal: false,
      actor,
    });
    return row;
  });
  return updated;
}

export async function addOrderNote(db: DbOrTx, id: string, note: string, actor: string): Promise<void> {
  const body = note.trim();
  if (!body) throw new ValidationError("Write a note first.", { note: "Required" });
  await db.insert(orderEvents).values({ orderId: id, type: "note", message: body.slice(0, 2000), isInternal: true, actor });
}

/** Records cash collected for a Cash on Delivery order (or another offline payment). */
export async function recordOfflinePayment(db: Database, id: string, actor: string, opts: { method: string; reference?: string }): Promise<void> {
  await db.transaction(async (tx) => {
    const order = await lockOrder(tx, id);
    if (order.status === "cancelled") throw new ValidationError("This order is cancelled.");
    if (order.paymentStatus === "paid") throw new ValidationError("This order is already marked as paid.");
    if (order.paymentMethod !== "cod" && order.paymentStatus === "pending") throw new ValidationError("Online payments are confirmed by the payment gateway, not recorded by hand.");
    const now = new Date();
    await tx.insert(payments).values({ orderId: id, provider: order.paymentMethod === "cod" ? "cod" : "manual", amountPaise: order.totalPaise, status: "captured", method: opts.method.slice(0, 40), capturedAt: now, providerPaymentId: null });
    await tx.update(orders).set({ paymentStatus: "paid", updatedAt: now }).where(eq(orders.id, id));
    await tx.insert(orderEvents).values({ orderId: id, type: "payment", message: `Payment of ${formatINR(order.totalPaise)} recorded (${opts.method}${opts.reference ? `, ref ${opts.reference.slice(0, 60)}` : ""}).`, isInternal: true, actor });
  });
}

export async function dashboardSummary(db: DbOrTx, lowStockThreshold: number) {
  const counts = await db.execute<{ status: string; n: number }>(sql`SELECT status, count(*)::int AS n FROM orders GROUP BY status`);
  const byStatus = Object.fromEntries(counts.rows.map((r) => [r.status, Number(r.n)])) as Partial<Record<OrderStatus, number>>;
  const sales = await db.execute<{ period: string; orders: number; revenue: number }>(sql`
    SELECT p.period, count(o.id)::int AS orders, COALESCE(SUM(o.total_paise - o.refunded_paise), 0)::bigint AS revenue
    FROM (VALUES ('today', 0), ('7d', 6), ('30d', 29)) AS p(period, days)
    LEFT JOIN orders o ON o.payment_status IN ('paid', 'partially_refunded')
      AND (o.created_at AT TIME ZONE 'Asia/Kolkata')::date >= (now() AT TIME ZONE 'Asia/Kolkata')::date - p.days
    GROUP BY p.period`);
  const enquiries = await db.execute<{ status: string; n: number }>(sql`SELECT status, count(*)::int AS n FROM bulk_enquiries GROUP BY status`);
  const lowStock = await db.execute<{ id: string; product_id: string; name: string; label: string; stock_quantity: number }>(sql`
    SELECT v.id, v.product_id, p.name, v.label, v.stock_quantity FROM product_variants v JOIN products p ON p.id = v.product_id
    WHERE v.is_active AND v.track_inventory AND p.status = 'published' AND v.stock_quantity <= ${lowStockThreshold}
    ORDER BY v.stock_quantity ASC, p.name LIMIT 20`);
  const upcoming = await db
    .select()
    .from(orders)
    .where(inArray(orders.status, ["pending_confirmation", "confirmed", "preparing", "ready_for_dispatch", "out_for_delivery"]))
    .orderBy(asc(orders.deliveryDate), asc(orders.createdAt))
    .limit(10);
  return {
    byStatus,
    awaitingAction: (byStatus.pending_confirmation ?? 0) + (byStatus.confirmed ?? 0) + (byStatus.preparing ?? 0) + (byStatus.ready_for_dispatch ?? 0),
    sales: Object.fromEntries(sales.rows.map((r) => [r.period, { orders: Number(r.orders), revenuePaise: Number(r.revenue) }])) as Record<"today" | "7d" | "30d", { orders: number; revenuePaise: number }>,
    enquiries: Object.fromEntries(enquiries.rows.map((r) => [r.status, Number(r.n)])) as Record<string, number>,
    lowStock: lowStock.rows,
    upcoming,
  };
}

// ---------------------------------------------------------------------------
// Orders entered by the owner (for example a confirmed bulk quotation)
// ---------------------------------------------------------------------------

export const manualOrderSchema = z.object({
  customerName: trimmed(120).min(2, "Enter the customer or institution name"),
  phone: z.string().transform((v, ctx) => {
    const n = normalizeIndianMobile(v);
    if (!n) ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Enter a valid 10-digit mobile number" });
    return n ?? "";
  }),
  email: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || null),
  addressLine1: trimmed(300).min(5, "Enter the delivery address"),
  locality: trimmed(80).default(""),
  city: trimmed(80).min(2, "Enter the town or city"),
  pincode: z.string().trim().regex(/^[1-9]\d{5}$/, "Enter a valid 6-digit PIN code"),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose the delivery date"),
  slotLabel: trimmed(80).default(""),
  notes: trimmed(1000).default(""),
  deliveryFeePaise: z.number().int().min(0),
  paymentStatus: z.enum(["unpaid", "paid"]),
  items: z
    .array(z.object({ description: trimmed(120).min(2), quantity: z.number().int().min(1).max(100000), unitLabel: trimmed(40).min(1), unitPricePaise: z.number().int().min(1) }))
    .min(1, "Add at least one line with a description, quantity, unit and price"),
});

export async function createManualOrder(db: Database, raw: unknown, actor: string, opts: { bulkEnquiryId?: string | null } = {}): Promise<Order> {
  const parsed = manualOrderSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError("Please fix the highlighted fields.", fieldErrorsFromZod(parsed.error));
  const m = parsed.data;
  const subtotal = m.items.reduce((s, i) => s + i.quantity * i.unitPricePaise, 0);
  return db.transaction(async (tx) => {
    const found = await tx.execute<{ id: string; name: string }>(sql`SELECT z.id, z.name FROM zone_pincodes p JOIN delivery_zones z ON z.id = p.zone_id WHERE p.pincode = ${m.pincode} LIMIT 1`);
    const zone = found.rows[0];
    const now = new Date();
    const [order] = await tx
      .insert(orders)
      .values({
        orderNumber: randomReference("SW"),
        idempotencyKey: `manual:${crypto.randomUUID()}`,
        status: "confirmed",
        paymentStatus: m.paymentStatus,
        paymentMethod: "cod",
        customerName: m.customerName,
        phone: m.phone,
        email: m.email,
        addressLine1: m.addressLine1,
        locality: m.locality || m.city,
        city: m.city,
        pincode: m.pincode,
        zoneId: zone?.id ?? null,
        zoneName: zone?.name ?? "Arranged delivery",
        deliveryDate: m.deliveryDate,
        slotLabel: m.slotLabel,
        customerNotes: m.notes,
        subtotalPaise: subtotal,
        deliveryFeePaise: m.deliveryFeePaise,
        totalPaise: subtotal + m.deliveryFeePaise,
        source: opts.bulkEnquiryId ? "bulk_enquiry" : "admin",
        bulkEnquiryId: opts.bulkEnquiryId ?? null,
        confirmedAt: now,
      })
      .returning();
    await tx.insert(orderItems).values(
      m.items.map((i) => ({ orderId: order.id, productName: i.description, sku: "MANUAL", unitLabel: i.unitLabel, unitPricePaise: i.unitPricePaise, quantity: i.quantity, lineTotalPaise: i.quantity * i.unitPricePaise })),
    );
    if (m.paymentStatus === "paid") await tx.insert(payments).values({ orderId: order.id, provider: "manual", amountPaise: order.totalPaise, status: "captured", method: "recorded", capturedAt: now });
    await tx.insert(orderEvents).values({ orderId: order.id, type: "created", toStatus: "confirmed", message: opts.bulkEnquiryId ? "Order confirmed from a bulk quotation." : "Order entered by the shop.", isInternal: false, actor });
    return order;
  });
}

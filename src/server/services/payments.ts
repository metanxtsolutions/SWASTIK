import { and, desc, eq, sql } from "drizzle-orm";
import type { Database, DbOrTx } from "../db/client";
import { orderEvents, orders, payments, refunds, webhookEvents } from "../db/schema";
import { AppError, NotFoundError, ValidationError } from "../errors";
import { gateway, type PaymentGateway } from "../payments";
import type { ParsedWebhook } from "../payments/types";
import { formatINR } from "@/lib/money";
import { getOrderByAccess, notifyOrder, type Order } from "./orders";
import { getAllSettings } from "./settings";

/**
 * Online payments. An order is marked paid only after the server has verified
 * either the checkout signature or a signed webhook from the gateway. Both paths
 * run the same idempotent capture, so a payment is applied exactly once however
 * many times the browser callback or the webhook arrives.
 */

export interface CheckoutParams {
  gateway: "razorpay" | "mock";
  isTest: boolean;
  keyId: string | null;
  providerOrderId: string;
  amountPaise: number;
  orderNumber: string;
  businessName: string;
  prefill: { name: string; contact: string; email: string | null };
}

/** Starts (or resumes) the online payment for a pending order the customer has access to. */
export async function startPayment(db: Database, orderNumber: string, token: string): Promise<CheckoutParams> {
  const found = await getOrderByAccess(db, orderNumber, token);
  if (!found) throw new NotFoundError("Order not found");
  const { order } = found;
  if (order.paymentMethod !== "online") throw new ValidationError("This order is not paid online.");
  if (order.paymentStatus === "paid") throw new ValidationError("This order is already paid.");
  if (order.status !== "pending_payment") throw new ValidationError("This order can no longer be paid. Please place a new order.");
  if (order.paymentExpiresAt && order.paymentExpiresAt < new Date()) throw new ValidationError("The time to pay for this order has passed. Please place a new order.");
  const gw = gateway();
  if (!gw) throw new AppError("Online payment is not available right now.");

  const { business } = await getAllSettings(db, ["business"]);
  // Reuse an open gateway order for the same amount so retries do not create duplicates.
  const [open] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.orderId, order.id), eq(payments.status, "created"), eq(payments.provider, gw.name), eq(payments.amountPaise, order.totalPaise)))
    .orderBy(desc(payments.createdAt))
    .limit(1);
  let providerOrderId = open?.providerOrderId ?? null;
  if (!providerOrderId) {
    const created = await gw.createOrder({ amountPaise: order.totalPaise, receipt: order.orderNumber, notes: { order_number: order.orderNumber } });
    providerOrderId = created.providerOrderId;
    await db.insert(payments).values({ orderId: order.id, provider: gw.name, providerOrderId, amountPaise: order.totalPaise, status: "created", isTest: gw.isTest });
  }
  return {
    gateway: gw.name,
    isTest: gw.isTest,
    keyId: gw.name === "razorpay" ? (gw as PaymentGateway & { keyId: string }).keyId : null,
    providerOrderId,
    amountPaise: order.totalPaise,
    orderNumber: order.orderNumber,
    businessName: business.name,
    prefill: { name: order.customerName, contact: order.phone, email: order.email },
  };
}

type CaptureResult = "captured" | "duplicate" | "late_capture" | "amount_mismatch" | "unknown_order";

/** Applies a verified captured payment. Idempotent. */
export async function capturePayment(
  db: Database,
  input: { providerOrderId: string; providerPaymentId: string; amountPaise?: number; method?: string | null },
): Promise<{ result: CaptureResult; orderId: string | null }> {
  const outcome = await db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.providerOrderId, input.providerOrderId)).limit(1);
    if (!payment) return { result: "unknown_order" as const, orderId: null };
    await tx.execute(sql`SELECT id FROM orders WHERE id = ${payment.orderId} FOR UPDATE`);
    const [locked] = await tx.select().from(payments).where(eq(payments.id, payment.id));
    const [order] = await tx.select().from(orders).where(eq(orders.id, payment.orderId));
    if (locked.status === "captured") return { result: "duplicate" as const, orderId: order.id };
    const amount = input.amountPaise ?? locked.amountPaise;
    const now = new Date();
    await tx
      .update(payments)
      .set({ status: "captured", providerPaymentId: input.providerPaymentId, method: input.method ?? locked.method, capturedAt: now, updatedAt: now, failureReason: null })
      .where(eq(payments.id, locked.id));
    if (amount !== order.totalPaise) {
      await tx.update(orders).set({ paymentStatus: "refund_pending", updatedAt: now }).where(eq(orders.id, order.id));
      await tx.insert(orderEvents).values({ orderId: order.id, type: "payment", message: `Payment of ${formatINR(amount)} does not match the order total ${formatINR(order.totalPaise)}. Review and refund.`, actor: "system" });
      return { result: "amount_mismatch" as const, orderId: order.id };
    }
    if (order.status !== "pending_payment") {
      // Paid after the order expired or was cancelled: the money must go back unless the owner reinstates the order.
      await tx.update(orders).set({ paymentStatus: "refund_pending", updatedAt: now }).where(eq(orders.id, order.id));
      await tx.insert(orderEvents).values({ orderId: order.id, type: "payment", message: `Payment of ${formatINR(amount)} received after the order was ${order.status === "cancelled" ? "cancelled" : "closed"}. A refund is needed.`, actor: "system" });
      return { result: "late_capture" as const, orderId: order.id };
    }
    await tx.update(orders).set({ status: "pending_confirmation", paymentStatus: "paid", paymentExpiresAt: null, updatedAt: now }).where(eq(orders.id, order.id));
    await tx.insert(orderEvents).values({
      orderId: order.id,
      type: "payment",
      fromStatus: "pending_payment",
      toStatus: "pending_confirmation",
      message: `Payment of ${formatINR(amount)} received${locked.isTest ? " (test mode)" : ""}. Waiting for confirmation.`,
      isInternal: false,
      actor: "system",
    });
    return { result: "captured" as const, orderId: order.id };
  });
  if (outcome.result === "captured" && outcome.orderId) await notifyOrder(db, outcome.orderId, "paid");
  return outcome;
}

export async function failPayment(db: Database, input: { providerOrderId: string; providerPaymentId?: string; reason?: string | null }): Promise<void> {
  const failedOrderId = await db.transaction(async (tx) => {
    const [payment] = await tx.select().from(payments).where(eq(payments.providerOrderId, input.providerOrderId)).limit(1);
    if (!payment || payment.status === "captured") return null;
    await tx.execute(sql`SELECT id FROM orders WHERE id = ${payment.orderId} FOR UPDATE`);
    const [order] = await tx.select().from(orders).where(eq(orders.id, payment.orderId));
    // The customer can try again with the same gateway order while the payment window is open.
    await tx.update(payments).set({ failureReason: input.reason?.slice(0, 300) ?? "Payment failed", updatedAt: new Date() }).where(eq(payments.id, payment.id));
    if (order.status === "pending_payment" && order.paymentStatus !== "paid") {
      await tx.update(orders).set({ paymentStatus: "failed", updatedAt: new Date() }).where(eq(orders.id, order.id));
      await tx.insert(orderEvents).values({ orderId: order.id, type: "payment", message: `Payment attempt failed${input.reason ? `: ${input.reason.slice(0, 200)}` : ""}. You can try again.`, isInternal: false, actor: "system" });
      return order.id;
    }
    return null;
  });
  if (failedOrderId) await notifyOrder(db, failedOrderId, "payment_failed");
}

/** Handles the browser callback from Razorpay Checkout after the signature is verified. */
export async function confirmCheckout(db: Database, input: { orderNumber: string; token: string; providerOrderId: string; providerPaymentId: string; signature: string }) {
  const found = await getOrderByAccess(db, input.orderNumber, input.token);
  if (!found) throw new NotFoundError("Order not found");
  const gw = gateway();
  if (!gw) throw new AppError("Online payment is not available right now.");
  const [payment] = await db.select().from(payments).where(and(eq(payments.providerOrderId, input.providerOrderId), eq(payments.orderId, found.order.id))).limit(1);
  if (!payment) throw new ValidationError("This payment does not belong to the order.");
  if (!gw.verifyCheckoutSignature({ providerOrderId: input.providerOrderId, providerPaymentId: input.providerPaymentId, signature: input.signature })) {
    throw new ValidationError("We could not verify this payment. If money was deducted, it will be confirmed automatically or refunded.");
  }
  return capturePayment(db, { providerOrderId: input.providerOrderId, providerPaymentId: input.providerPaymentId });
}

/**
 * Processes a gateway webhook. The signature is checked over the raw body first;
 * the event id is recorded so a redelivered event is not processed twice.
 */
export async function handleWebhook(db: Database, rawBody: string, headers: Headers): Promise<{ status: number; result: string }> {
  const gw = gateway();
  if (!gw) return { status: 503, result: "gateway_not_configured" };
  if (!gw.verifyWebhook(rawBody, headers)) return { status: 401, result: "invalid_signature" };
  let event: ParsedWebhook;
  try {
    event = gw.parseWebhook(rawBody, headers);
  } catch {
    return { status: 400, result: "invalid_payload" };
  }
  const inserted = await db
    .insert(webhookEvents)
    .values({ id: `${gw.name}:${event.eventId}`, provider: gw.name, type: event.rawType, payload: JSON.parse(rawBody) })
    .onConflictDoNothing()
    .returning({ id: webhookEvents.id });
  if (!inserted.length) {
    const [prior] = await db.select().from(webhookEvents).where(eq(webhookEvents.id, `${gw.name}:${event.eventId}`));
    if (prior?.processedAt) return { status: 200, result: "duplicate" };
  }
  const id = `${gw.name}:${event.eventId}`;
  try {
    let result = "ignored";
    if (event.type === "payment.captured" && event.providerOrderId && event.providerPaymentId) {
      result = (await capturePayment(db, { providerOrderId: event.providerOrderId, providerPaymentId: event.providerPaymentId, amountPaise: event.amountPaise, method: event.method })).result;
    } else if (event.type === "payment.failed" && event.providerOrderId) {
      await failPayment(db, { providerOrderId: event.providerOrderId, providerPaymentId: event.providerPaymentId, reason: event.failureReason });
      result = "failed_recorded";
    } else if ((event.type === "refund.processed" || event.type === "refund.failed") && event.providerRefundId) {
      result = await applyRefundUpdate(db, event.providerRefundId, event.type === "refund.processed" ? "processed" : "failed");
    }
    await db.update(webhookEvents).set({ processedAt: new Date(), error: null }).where(eq(webhookEvents.id, id));
    return { status: 200, result };
  } catch (e) {
    await db
      .update(webhookEvents)
      .set({ error: (e instanceof Error ? e.message : String(e)).slice(0, 500) })
      .where(eq(webhookEvents.id, id));
    // A 5xx makes the gateway retry later.
    return { status: 500, result: "error" };
  }
}

// ---------------------------------------------------------------------------
// Refunds
// ---------------------------------------------------------------------------

export function paymentStatusAfterRefund(order: Pick<Order, "totalPaise" | "status">, refundedPaise: number, pending: boolean): Order["paymentStatus"] {
  if (pending) return "refund_pending";
  if (refundedPaise >= order.totalPaise) return "refunded";
  if (refundedPaise > 0) return "partially_refunded";
  // Nothing refunded yet: a cancelled paid order still owes the customer their money.
  return order.status === "cancelled" ? "refund_pending" : "paid";
}

async function recomputeRefunds(tx: DbOrTx, orderId: string): Promise<void> {
  const [order] = await tx.select().from(orders).where(eq(orders.id, orderId));
  const rows = await tx.select().from(refunds).where(eq(refunds.orderId, orderId));
  const refunded = rows.filter((r) => r.status === "processed" || r.status === "recorded").reduce((s, r) => s + r.amountPaise, 0);
  const pending = rows.some((r) => r.status === "pending");
  await tx
    .update(orders)
    .set({ refundedPaise: refunded, paymentStatus: paymentStatusAfterRefund(order, refunded, pending), updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}

async function applyRefundUpdate(db: Database, providerRefundId: string, status: "processed" | "failed"): Promise<string> {
  const orderId = await db.transaction(async (tx) => {
    const [refund] = await tx.select().from(refunds).where(eq(refunds.providerRefundId, providerRefundId)).limit(1);
    if (!refund || refund.status === status) return null;
    await tx.execute(sql`SELECT id FROM orders WHERE id = ${refund.orderId} FOR UPDATE`);
    await tx.update(refunds).set({ status, updatedAt: new Date() }).where(eq(refunds.id, refund.id));
    await tx.insert(orderEvents).values({ orderId: refund.orderId, type: "refund", message: `Refund of ${formatINR(refund.amountPaise)} ${status === "processed" ? "processed" : "failed"} at the gateway.`, actor: "system" });
    await recomputeRefunds(tx, refund.orderId);
    return refund.orderId;
  });
  if (orderId && status === "processed") await notifyOrder(db, orderId, "refund");
  return orderId ? `refund_${status}` : "refund_unknown";
}

/**
 * Refunds an order. Online payments are refunded through the gateway; cash and
 * other offline payments are recorded as refunded by the owner.
 */
export async function refundOrder(db: Database, orderId: string, amountPaise: number, reason: string, actor: string): Promise<void> {
  if (!Number.isInteger(amountPaise) || amountPaise <= 0) throw new ValidationError("Enter the amount to refund.", { amount: "Required" });
  if (!reason.trim()) throw new ValidationError("Enter a reason for the refund.", { reason: "Required" });
  const [order] = await db.select().from(orders).where(eq(orders.id, orderId)).limit(1);
  if (!order) throw new NotFoundError("Order not found");
  const capturedRows = await db.select().from(payments).where(and(eq(payments.orderId, orderId), eq(payments.status, "captured")));
  const captured = capturedRows.reduce((s, p) => s + p.amountPaise, 0);
  const existing = await db.select().from(refunds).where(eq(refunds.orderId, orderId));
  const committed = existing.filter((r) => r.status !== "failed").reduce((s, r) => s + r.amountPaise, 0);
  if (!captured) throw new ValidationError("No payment has been received for this order, so there is nothing to refund.");
  if (amountPaise > captured - committed) throw new ValidationError(`At most ${formatINR(captured - committed)} can be refunded.`, { amount: "Too much" });

  const online = capturedRows.find((p) => (p.provider === "razorpay" || p.provider === "mock") && p.providerPaymentId);
  if (online) {
    const gw = gateway();
    if (!gw || gw.name !== online.provider) throw new AppError("The payment gateway for this payment is not configured, so the refund cannot be sent.");
    const res = await gw.refund(online.providerPaymentId!, amountPaise, `${order.orderNumber}-R${existing.length + 1}`);
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`);
      await tx.insert(refunds).values({ orderId, paymentId: online.id, amountPaise, status: res.status, providerRefundId: res.providerRefundId || null, reason: reason.trim().slice(0, 300) });
      await tx.insert(orderEvents).values({
        orderId,
        type: "refund",
        message: res.status === "failed" ? `Refund of ${formatINR(amountPaise)} failed at the gateway: ${res.error ?? "unknown error"}` : `Refund of ${formatINR(amountPaise)} ${res.status === "processed" ? "processed" : "initiated"}: ${reason.trim()}`,
        actor,
      });
      await recomputeRefunds(tx, orderId);
    });
    if (res.status === "failed") throw new AppError(`The gateway refused the refund: ${res.error ?? "unknown error"}`);
  } else {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM orders WHERE id = ${orderId} FOR UPDATE`);
      await tx.insert(refunds).values({ orderId, paymentId: capturedRows[0]?.id ?? null, amountPaise, status: "recorded", reason: reason.trim().slice(0, 300) });
      await tx.insert(orderEvents).values({ orderId, type: "refund", message: `Refund of ${formatINR(amountPaise)} recorded as paid back to the customer: ${reason.trim()}`, actor });
      await recomputeRefunds(tx, orderId);
    });
  }
  await notifyOrder(db, orderId, "refund");
}

import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { orders, payments, productVariants, refunds, webhookEvents } from "@/server/db/schema";
import { MockGateway, RazorpayGateway, setGatewayForTests } from "@/server/payments";
import { expireUnpaidOrders, placeOrder } from "@/server/services/orders";
import { capturePayment, confirmCheckout, handleWebhook, refundOrder, startPayment } from "@/server/services/payments";
import { checkoutInput, db, makeCatalogue, makeZone, NOW } from "./helpers";

const gw = new MockGateway("test-secret");

async function onlineOrder() {
  setGatewayForTests(gw);
  const { variant } = await makeCatalogue();
  const { slot } = await makeZone();
  const placed = await placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, paymentMethod: "online", expectedTotalPaise: 11000 }), { now: NOW });
  const params = await startPayment(db(), placed.orderNumber, placed.accessToken);
  return { placed, params, variant };
}

function webhook(event: Record<string, unknown>) {
  const { body, signature } = gw.simulate(event);
  return { body, headers: new Headers({ "x-test-signature": signature }) };
}

async function order(id: string) {
  return (await db().select().from(orders).where(eq(orders.id, id)))[0];
}

describe("payments", () => {
  it("does not mark an order paid without a verified gateway event", async () => {
    const { placed } = await onlineOrder();
    const o = await order(placed.orderId);
    expect(o.status).toBe("pending_payment");
    expect(o.paymentStatus).toBe("pending");
  });

  it("refuses webhooks with a bad signature", async () => {
    const { placed, params } = await onlineOrder();
    const { body } = gw.simulate({ type: "payment.captured", order_id: params.providerOrderId, payment_id: "p1", amount: 11000 });
    const r = await handleWebhook(db(), body, new Headers({ "x-test-signature": "0".repeat(64) }));
    expect(r.status).toBe(401);
    expect((await order(placed.orderId)).paymentStatus).toBe("pending");
  });

  it("captures a payment once even when the webhook is delivered twice", async () => {
    const { placed, params } = await onlineOrder();
    const w = webhook({ type: "payment.captured", order_id: params.providerOrderId, payment_id: "pay_1", amount: 11000 });
    expect((await handleWebhook(db(), w.body, w.headers)).result).toBe("captured");
    expect((await handleWebhook(db(), w.body, w.headers)).result).toBe("duplicate");
    // A different event for the same payment is also a no-op.
    const w2 = webhook({ type: "payment.captured", order_id: params.providerOrderId, payment_id: "pay_1", amount: 11000 });
    expect((await handleWebhook(db(), w2.body, w2.headers)).result).toBe("duplicate");
    const o = await order(placed.orderId);
    expect(o.status).toBe("pending_confirmation");
    expect(o.paymentStatus).toBe("paid");
    expect(await db().select().from(webhookEvents)).toHaveLength(2);
  });

  it("reuses the open gateway order when the customer retries payment", async () => {
    const { placed, params } = await onlineOrder();
    const again = await startPayment(db(), placed.orderNumber, placed.accessToken);
    expect(again.providerOrderId).toBe(params.providerOrderId);
    expect(await db().select().from(payments).where(eq(payments.orderId, placed.orderId))).toHaveLength(1);
  });

  it("records a failed attempt and still accepts a later success", async () => {
    const { placed, params } = await onlineOrder();
    const f = webhook({ type: "payment.failed", order_id: params.providerOrderId, payment_id: "pay_x", failure_reason: "Card declined" });
    await handleWebhook(db(), f.body, f.headers);
    expect((await order(placed.orderId)).paymentStatus).toBe("failed");
    const s = webhook({ type: "payment.captured", order_id: params.providerOrderId, payment_id: "pay_y", amount: 11000 });
    await handleWebhook(db(), s.body, s.headers);
    expect((await order(placed.orderId)).paymentStatus).toBe("paid");
  });

  it("flags a payment that does not match the order total", async () => {
    const { placed, params } = await onlineOrder();
    const r = await capturePayment(db(), { providerOrderId: params.providerOrderId, providerPaymentId: "pay_m", amountPaise: 100 });
    expect(r.result).toBe("amount_mismatch");
    const o = await order(placed.orderId);
    expect(o.status).toBe("pending_payment");
    expect(o.paymentStatus).toBe("refund_pending");
  });

  it("marks a payment that arrives after the order expired for refund, without reviving the order", async () => {
    const { placed, params } = await onlineOrder();
    await expireUnpaidOrders(db(), new Date(NOW.getTime() + 60 * 60_000));
    const r = await capturePayment(db(), { providerOrderId: params.providerOrderId, providerPaymentId: "pay_late", amountPaise: 11000 });
    expect(r.result).toBe("late_capture");
    const o = await order(placed.orderId);
    expect(o.status).toBe("cancelled");
    expect(o.paymentStatus).toBe("refund_pending");
  });

  it("verifies the checkout signature returned to the browser", async () => {
    const { placed, params } = await onlineOrder();
    await expect(confirmCheckout(db(), { orderNumber: placed.orderNumber, token: placed.accessToken, providerOrderId: params.providerOrderId, providerPaymentId: "pay_s", signature: "bad" })).rejects.toThrow(/could not verify/);
    const signature = createHmac("sha256", "test-secret").update(`${params.providerOrderId}|pay_s`).digest("hex");
    const r = await confirmCheckout(db(), { orderNumber: placed.orderNumber, token: placed.accessToken, providerOrderId: params.providerOrderId, providerPaymentId: "pay_s", signature });
    expect(r.result).toBe("captured");
    await expect(confirmCheckout(db(), { orderNumber: placed.orderNumber, token: "wrong-token-wrong-token-wrong-tok", providerOrderId: params.providerOrderId, providerPaymentId: "pay_s", signature })).rejects.toThrow(/not found/i);
  });

  it("refunds through the gateway and tracks partial and full refunds", async () => {
    const { placed, params } = await onlineOrder();
    await capturePayment(db(), { providerOrderId: params.providerOrderId, providerPaymentId: "pay_r", amountPaise: 11000 });
    await refundOrder(db(), placed.orderId, 1000, "One item missing", "admin:test");
    expect((await order(placed.orderId)).paymentStatus).toBe("partially_refunded");
    await expect(refundOrder(db(), placed.orderId, 20000, "Too much", "admin:test")).rejects.toThrow(/At most/);
    await refundOrder(db(), placed.orderId, 10000, "Rest", "admin:test");
    const o = await order(placed.orderId);
    expect(o.paymentStatus).toBe("refunded");
    expect(o.refundedPaise).toBe(11000);
    expect(await db().select().from(refunds).where(eq(refunds.orderId, placed.orderId))).toHaveLength(2);
  });

  it("does not allow paying a cancelled order", async () => {
    const { placed } = await onlineOrder();
    await expireUnpaidOrders(db(), new Date(NOW.getTime() + 60 * 60_000));
    await expect(startPayment(db(), placed.orderNumber, placed.accessToken)).rejects.toThrow(/can no longer be paid/);
  });

  it("keeps reserved stock while paid", async () => {
    const { params, variant } = await onlineOrder();
    await capturePayment(db(), { providerOrderId: params.providerOrderId, providerPaymentId: "p", amountPaise: 11000 });
    await expireUnpaidOrders(db(), new Date(NOW.getTime() + 60 * 60_000));
    const [v] = await db().select().from(productVariants).where(eq(productVariants.id, variant.id));
    expect(v.stockQuantity).toBe(8);
  });
});

describe("Razorpay adapter", () => {
  const fake = (async () => new Response("{}")) as unknown as typeof fetch;
  const rp = new RazorpayGateway("rzp_test_abc", "key_secret", "hook_secret", fake);

  it("detects test keys", () => {
    expect(rp.isTest).toBe(true);
    expect(new RazorpayGateway("rzp_live_abc", "s", "w", fake).isTest).toBe(false);
  });

  it("verifies checkout and webhook signatures with HMAC-SHA256", () => {
    const sig = createHmac("sha256", "key_secret").update("order_1|pay_1").digest("hex");
    expect(rp.verifyCheckoutSignature({ providerOrderId: "order_1", providerPaymentId: "pay_1", signature: sig })).toBe(true);
    expect(rp.verifyCheckoutSignature({ providerOrderId: "order_1", providerPaymentId: "pay_2", signature: sig })).toBe(false);
    const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1", order_id: "order_1", amount: 11000, method: "upi" } } } });
    const whSig = createHmac("sha256", "hook_secret").update(body).digest("hex");
    const headers = new Headers({ "x-razorpay-signature": whSig, "x-razorpay-event-id": "evt_1" });
    expect(rp.verifyWebhook(body, headers)).toBe(true);
    expect(rp.verifyWebhook(body + " ", headers)).toBe(false);
    expect(rp.parseWebhook(body, headers)).toMatchObject({ eventId: "evt_1", type: "payment.captured", providerOrderId: "order_1", providerPaymentId: "pay_1", amountPaise: 11000, method: "upi" });
  });

  it("sends amounts in paise to the Orders API", async () => {
    let sent: Record<string, unknown> = {};
    const capture = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ id: "order_X" }), { status: 200 });
    }) as unknown as typeof fetch;
    const g = new RazorpayGateway("rzp_test_abc", "s", "w", capture);
    expect(await g.createOrder({ amountPaise: 12345, receipt: "SW-ABCDEFGH", notes: {} })).toEqual({ providerOrderId: "order_X" });
    expect(sent).toMatchObject({ amount: 12345, currency: "INR", receipt: "SW-ABCDEFGH" });
  });
});

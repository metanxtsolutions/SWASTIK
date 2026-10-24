import { hmacSha256Hex, safeEqual } from "../crypto";
import type { CreatedGatewayOrder, ParsedWebhook, PaymentGateway, RefundResult } from "./types";

/**
 * Razorpay Orders API + Standard Checkout + webhooks + refunds.
 * Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/
 * Not yet exercised against Razorpay from this repository: verify end to end in
 * Razorpay test mode (rzp_test_ keys) before switching to live keys.
 */
export class RazorpayGateway implements PaymentGateway {
  readonly name = "razorpay" as const;
  readonly isTest: boolean;

  constructor(
    readonly keyId: string,
    private keySecret: string,
    private webhookSecret: string,
    private fetchFn: typeof fetch = fetch,
  ) {
    this.isTest = keyId.startsWith("rzp_test_");
  }

  private auth() {
    return `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")}`;
  }

  async createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<CreatedGatewayOrder> {
    const res = await this.fetchFn("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { Authorization: this.auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ amount: input.amountPaise, currency: "INR", receipt: input.receipt.slice(0, 40), notes: input.notes }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; error?: { description?: string } };
    if (!res.ok || !body.id) throw new Error(`Razorpay order creation failed: ${body.error?.description ?? res.status}`);
    return { providerOrderId: body.id };
  }

  verifyCheckoutSignature(input: { providerOrderId: string; providerPaymentId: string; signature: string }): boolean {
    if (!input.signature) return false;
    return safeEqual(input.signature, hmacSha256Hex(this.keySecret, `${input.providerOrderId}|${input.providerPaymentId}`));
  }

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    const sig = headers.get("x-razorpay-signature") ?? "";
    return !!sig && !!this.webhookSecret && safeEqual(sig, hmacSha256Hex(this.webhookSecret, rawBody));
  }

  parseWebhook(rawBody: string, headers: Headers): ParsedWebhook {
    const b = JSON.parse(rawBody) as { event: string; payload?: Record<string, { entity?: Record<string, unknown> }> };
    const payment = b.payload?.payment?.entity ?? {};
    const refund = b.payload?.refund?.entity ?? {};
    const map: Record<string, ParsedWebhook["type"]> = {
      "payment.captured": "payment.captured",
      "order.paid": "payment.captured",
      "payment.failed": "payment.failed",
      "refund.processed": "refund.processed",
      "refund.failed": "refund.failed",
    };
    return {
      eventId: headers.get("x-razorpay-event-id") ?? `${b.event}:${String(payment.id ?? refund.id ?? "")}`,
      rawType: b.event,
      type: map[b.event] ?? "ignored",
      providerOrderId: payment.order_id ? String(payment.order_id) : undefined,
      providerPaymentId: payment.id ? String(payment.id) : refund.payment_id ? String(refund.payment_id) : undefined,
      providerRefundId: refund.id ? String(refund.id) : undefined,
      amountPaise: payment.amount !== undefined ? Number(payment.amount) : refund.amount !== undefined ? Number(refund.amount) : undefined,
      method: payment.method ? String(payment.method) : null,
      failureReason: payment.error_description ? String(payment.error_description) : null,
    };
  }

  async refund(providerPaymentId: string, amountPaise: number, reference: string): Promise<RefundResult> {
    const res = await this.fetchFn(`https://api.razorpay.com/v1/payments/${encodeURIComponent(providerPaymentId)}/refund`, {
      method: "POST",
      headers: { Authorization: this.auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amountPaise, speed: "normal", receipt: reference.slice(0, 40) }),
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; status?: string; error?: { description?: string } };
    if (!res.ok || !body.id) return { providerRefundId: "", status: "failed", error: body.error?.description ?? `HTTP ${res.status}` };
    return { providerRefundId: body.id, status: body.status === "processed" ? "processed" : "pending" };
  }

  async fetchPayment(providerPaymentId: string) {
    const res = await this.fetchFn(`https://api.razorpay.com/v1/payments/${encodeURIComponent(providerPaymentId)}`, {
      headers: { Authorization: this.auth() },
      signal: AbortSignal.timeout(15_000),
    });
    const body = (await res.json()) as { status?: string; amount?: number; order_id?: string; method?: string };
    if (!res.ok) throw new Error(`Razorpay payment fetch failed: HTTP ${res.status}`);
    return { status: String(body.status), amountPaise: Number(body.amount), orderId: body.order_id ?? null, method: body.method ?? null };
  }
}

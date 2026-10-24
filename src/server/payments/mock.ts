import { randomUUID } from "node:crypto";
import { hmacSha256Hex, safeEqual } from "../crypto";
import type { CreatedGatewayOrder, ParsedWebhook, PaymentGateway, RefundResult } from "./types";

/**
 * Test-mode gateway for development and the hosted preview. It cannot move money
 * and is refused when APP_STAGE=production. The /pay/test page simulates an
 * outcome by sending a webhook signed with MOCK_WEBHOOK_SECRET through the same
 * verification and processing path that Razorpay webhooks use.
 */
export class MockGateway implements PaymentGateway {
  readonly name = "mock" as const;
  readonly isTest = true;
  constructor(private webhookSecret: string) {}

  async createOrder(input: { receipt: string }): Promise<CreatedGatewayOrder> {
    return { providerOrderId: `test_order_${input.receipt.replace(/[^A-Z0-9]/gi, "")}_${randomUUID().slice(0, 8)}` };
  }

  verifyCheckoutSignature(input: { providerOrderId: string; providerPaymentId: string; signature: string }): boolean {
    return !!input.signature && safeEqual(input.signature, hmacSha256Hex(this.webhookSecret, `${input.providerOrderId}|${input.providerPaymentId}`));
  }

  sign(rawBody: string): string {
    return hmacSha256Hex(this.webhookSecret, rawBody);
  }

  verifyWebhook(rawBody: string, headers: Headers): boolean {
    const sig = headers.get("x-test-signature") ?? "";
    return !!sig && safeEqual(sig, this.sign(rawBody));
  }

  parseWebhook(rawBody: string): ParsedWebhook {
    const b = JSON.parse(rawBody) as Record<string, unknown>;
    const type = String(b.type);
    return {
      eventId: String(b.id),
      rawType: type,
      type: ["payment.captured", "payment.failed", "refund.processed", "refund.failed"].includes(type) ? (type as ParsedWebhook["type"]) : "ignored",
      providerOrderId: b.order_id ? String(b.order_id) : undefined,
      providerPaymentId: b.payment_id ? String(b.payment_id) : undefined,
      providerRefundId: b.refund_id ? String(b.refund_id) : undefined,
      amountPaise: b.amount !== undefined ? Number(b.amount) : undefined,
      method: b.method ? String(b.method) : "test",
      failureReason: b.failure_reason ? String(b.failure_reason) : null,
    };
  }

  async refund(_providerPaymentId: string, _amountPaise: number, reference: string): Promise<RefundResult> {
    return { providerRefundId: `test_refund_${reference.replace(/[^A-Z0-9]/gi, "").slice(0, 24)}_${randomUUID().slice(0, 6)}`, status: "processed" };
  }

  /** Builds a signed webhook body for the test page and automated tests. */
  simulate(event: Record<string, unknown>) {
    const body = JSON.stringify({ id: `evt_test_${randomUUID()}`, ...event });
    return { body, signature: this.sign(body) };
  }
}

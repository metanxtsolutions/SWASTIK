/** Payment gateway boundary, so the provider can change without touching orders. Amounts are paise. */

export interface CreatedGatewayOrder {
  providerOrderId: string;
}

export type WebhookEventType = "payment.captured" | "payment.failed" | "refund.processed" | "refund.failed" | "ignored";

export interface ParsedWebhook {
  eventId: string;
  type: WebhookEventType;
  rawType: string;
  providerOrderId?: string;
  providerPaymentId?: string;
  providerRefundId?: string;
  amountPaise?: number;
  method?: string | null;
  failureReason?: string | null;
}

export interface RefundResult {
  providerRefundId: string;
  status: "processed" | "pending" | "failed";
  error?: string;
}

export interface PaymentGateway {
  name: "razorpay" | "mock";
  /** True for Razorpay test keys and the mock gateway: no real money moves. */
  isTest: boolean;
  createOrder(input: { amountPaise: number; receipt: string; notes: Record<string, string> }): Promise<CreatedGatewayOrder>;
  /** Verifies the signature the checkout returns to the browser after payment. */
  verifyCheckoutSignature(input: { providerOrderId: string; providerPaymentId: string; signature: string }): boolean;
  /** Verifies the webhook signature over the exact raw request body. */
  verifyWebhook(rawBody: string, headers: Headers): boolean;
  parseWebhook(rawBody: string, headers: Headers): ParsedWebhook;
  refund(providerPaymentId: string, amountPaise: number, reference: string): Promise<RefundResult>;
  /** Fetches the current state of a payment from the provider (used to reconcile). */
  fetchPayment?(providerPaymentId: string): Promise<{ status: string; amountPaise: number; orderId: string | null; method: string | null }>;
}

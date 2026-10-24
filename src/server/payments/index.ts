import { getEnv } from "../env";
import { MockGateway } from "./mock";
import { RazorpayGateway } from "./razorpay";
import type { PaymentGateway } from "./types";

let override: PaymentGateway | null = null;

export function setGatewayForTests(g: PaymentGateway | null) {
  override = g;
}

/** The configured online payment gateway, or null when online payment is not set up. */
export function gateway(): PaymentGateway | null {
  if (override) return override;
  const env = getEnv();
  if (env.PAYMENT_GATEWAY === "razorpay") {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return null;
    return new RazorpayGateway(env.RAZORPAY_KEY_ID, env.RAZORPAY_KEY_SECRET, env.RAZORPAY_WEBHOOK_SECRET);
  }
  if (env.PAYMENT_GATEWAY === "mock") {
    // Simulated payments are never available on the production site.
    if (env.APP_STAGE === "production") return null;
    return new MockGateway(env.MOCK_WEBHOOK_SECRET);
  }
  return null;
}

export function mockGateway(): MockGateway | null {
  const g = gateway();
  return g instanceof MockGateway ? g : null;
}

export type { PaymentGateway } from "./types";
export { MockGateway } from "./mock";
export { RazorpayGateway } from "./razorpay";

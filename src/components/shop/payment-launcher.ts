"use client";

import type { useRouter } from "next/navigation";

type Router = ReturnType<typeof useRouter>;

interface CheckoutParams {
  gateway: "razorpay" | "mock";
  isTest: boolean;
  keyId: string | null;
  providerOrderId: string;
  amountPaise: number;
  orderNumber: string;
  businessName: string;
  prefill: { name: string; contact: string; email: string | null };
}

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void; on: (event: string, cb: (r: unknown) => void) => void };
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("The payment window could not be loaded."));
    document.head.appendChild(s);
  });
}

/**
 * Opens the payment step for an order. The order page is the single source of
 * truth: whatever happens here, the customer ends up there and sees the status
 * the server has confirmed.
 */
export async function openPayment({ orderNumber, token, router, orderUrl }: { orderNumber: string; token: string; router: Router; orderUrl: string }): Promise<void> {
  try {
    const res = await fetch("/api/payments/start", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber, token }) });
    const params = (await res.json()) as CheckoutParams & { error?: string };
    if (!res.ok) throw new Error(params.error ?? "Payment could not be started.");
    if (params.gateway === "mock") {
      router.push(`/pay/test/${orderNumber}?t=${encodeURIComponent(token)}`);
      return;
    }
    await loadRazorpay();
    const rzp = new window.Razorpay!({
      key: params.keyId,
      amount: params.amountPaise,
      currency: "INR",
      name: params.businessName,
      description: `Order ${orderNumber}`,
      order_id: params.providerOrderId,
      prefill: { name: params.prefill.name, contact: `+91${params.prefill.contact}`, email: params.prefill.email ?? undefined },
      theme: { color: "#b4530a" },
      handler: async (resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
        await fetch("/api/payments/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderNumber, token, ...resp }),
        }).catch(() => undefined);
        router.push(`${orderUrl}&paid=1`);
      },
      modal: { ondismiss: () => router.push(orderUrl) },
    });
    rzp.open();
  } catch {
    router.push(`${orderUrl}&payment_error=1`);
  }
}

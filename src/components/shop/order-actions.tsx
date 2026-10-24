"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { openPayment } from "./payment-launcher";

export function PayNowButton({ orderNumber, token, label = "Pay now" }: { orderNumber: string; token: string; label?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      className="btn btn-primary"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await openPayment({ orderNumber, token, router, orderUrl: `/order/${orderNumber}?t=${encodeURIComponent(token)}` });
        setBusy(false);
      }}
    >
      {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
      {label}
    </button>
  );
}

/** While a payment is being confirmed by the gateway, check the server every few seconds. */
export function PaymentPoller({ orderNumber, token }: { orderNumber: string; token: string }) {
  const router = useRouter();
  const [gaveUp, setGaveUp] = useState(false);
  useEffect(() => {
    let n = 0;
    const t = setInterval(async () => {
      n++;
      try {
        const res = await fetch(`/api/orders/status?number=${orderNumber}&t=${encodeURIComponent(token)}`, { cache: "no-store" });
        const body = (await res.json()) as { paymentStatus?: string };
        if (body.paymentStatus && body.paymentStatus !== "pending") {
          clearInterval(t);
          router.replace(`/order/${orderNumber}?t=${encodeURIComponent(token)}`);
          router.refresh();
        }
      } catch {
        // Keep trying; the page still shows the last confirmed status.
      }
      if (n >= 20) {
        clearInterval(t);
        setGaveUp(true);
      }
    }, 3000);
    return () => clearInterval(t);
  }, [orderNumber, token, router]);
  return (
    <p className="flex items-center gap-2 text-sm text-ink-soft" role="status">
      {gaveUp ? "Still waiting for the payment provider. If money was deducted, this page will update once the payment is confirmed. You can refresh later." : (
        <>
          <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
          Confirming your payment with the payment provider…
        </>
      )}
    </p>
  );
}

export function SimulatePayment({ orderNumber, token }: { orderNumber: string; token: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"" | "success" | "failure">("");
  const [error, setError] = useState<string | null>(null);
  async function go(outcome: "success" | "failure") {
    setBusy(outcome);
    setError(null);
    const res = await fetch("/api/payments/test/simulate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber, token, outcome }) });
    if (!res.ok) {
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Simulation failed");
      setBusy("");
      return;
    }
    router.push(`/order/${orderNumber}?t=${encodeURIComponent(token)}`);
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row">
        <button type="button" className="btn btn-primary flex-1" disabled={!!busy} onClick={() => go("success")}>
          {busy === "success" ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
          Simulate successful payment
        </button>
        <button type="button" className="btn btn-secondary flex-1" disabled={!!busy} onClick={() => go("failure")}>
          {busy === "failure" ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
          Simulate failed payment
        </button>
      </div>
      {error ? <p className="field-error">{error}</p> : null}
    </div>
  );
}

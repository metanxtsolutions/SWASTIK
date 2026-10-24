"use client";

import { useState } from "react";
import { AlertCircle, Loader2, Package } from "lucide-react";
import { formatDateTime, formatDeliveryDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";

const STATUS: Record<string, string> = {
  pending_payment: "Waiting for payment",
  pending_confirmation: "Placed, waiting for confirmation",
  confirmed: "Confirmed",
  preparing: "Being prepared",
  ready_for_dispatch: "Ready for dispatch",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

interface Result {
  orderNumber: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string;
  deliveryDate: string;
  slotLabel: string;
  totalPaise: number;
  items: { productName: string; variantLabel: string; unitLabel: string; quantity: number }[];
  events: { message: string; createdAt: string }[];
}

export function TrackForm({ initialOrder }: { initialOrder: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-6">
      <form
        className="card grid gap-4 p-5 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
        onSubmit={async (e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setBusy(true);
          setError(null);
          setResult(null);
          try {
            const res = await fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orderNumber: String(fd.get("orderNumber")).trim().toUpperCase(), phone: String(fd.get("phone")) }) });
            const body = await res.json().catch(() => null);
            if (!res.ok) setError(body?.error ?? "We could not find that order.");
            else setResult(body);
          } catch {
            setError("You seem to be offline. Check your connection and try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <label htmlFor="t-order" className="field-label">
            Order number
          </label>
          <input id="t-order" name="orderNumber" defaultValue={initialOrder} placeholder="SW-XXXXXXXX" className="field-input uppercase" required autoCapitalize="characters" />
        </div>
        <div>
          <label htmlFor="t-phone" className="field-label">
            Mobile number used for the order
          </label>
          <input id="t-phone" name="phone" type="tel" inputMode="tel" className="field-input" required />
        </div>
        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
          Track order
        </button>
      </form>
      <div aria-live="polite">
        {error ? (
          <p className="flex items-center gap-2 rounded-xl bg-danger-soft p-3 text-sm font-medium">
            <AlertCircle aria-hidden className="h-4 w-4 text-danger" />
            {error}
          </p>
        ) : null}
        {result ? (
          <section className="card space-y-4 p-5">
            <div className="flex items-start gap-3">
              <Package aria-hidden className="h-6 w-6 text-saffron" />
              <div>
                <h2 className="text-xl font-semibold">{STATUS[result.status] ?? result.status}</h2>
                <p className="text-sm text-muted">
                  Order {result.orderNumber}, delivery {formatDeliveryDate(result.deliveryDate, { withYear: true })}
                  {result.slotLabel ? `, ${result.slotLabel}` : ""}. Total {formatINR(result.totalPaise)}.
                </p>
              </div>
            </div>
            <ul className="text-sm">
              {result.items.map((i, idx) => (
                <li key={idx}>
                  {i.quantity} × {i.productName}
                  {i.variantLabel ? ` (${i.variantLabel})` : ""}
                </li>
              ))}
            </ul>
            <ol className="space-y-2 border-l-2 border-line pl-4 text-sm">
              {[...result.events].reverse().map((e, i) => (
                <li key={i}>
                  {e.message} <span className="block text-xs text-muted">{formatDateTime(e.createdAt)}</span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-muted">For your privacy, the address and payment details are shown only on the order link you received when ordering.</p>
          </section>
        ) : null}
      </div>
    </div>
  );
}

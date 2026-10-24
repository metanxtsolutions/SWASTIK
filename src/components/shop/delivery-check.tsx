"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { CheckCircle2, Loader2, MapPin, XCircle } from "lucide-react";
import { cart, useCart, useHydrated } from "@/lib/cart-store";
import { formatINR } from "@/lib/money";
import { formatDeliveryDate } from "@/lib/dates";

export interface DeliveryResult {
  serviceable: boolean;
  pincode: string;
  reason?: "invalid" | "not_served";
  zone?: { id: string; name: string };
  localities?: string;
  deliveryFeePaise?: number;
  minOrderPaise?: number;
  freeDeliveryAbovePaise?: number | null;
  sameDayAvailable?: boolean;
  dates?: { date: string; slots: { id: string; label: string; available: boolean; reason?: string }[] }[];
}

export async function fetchDelivery(pincode: string): Promise<DeliveryResult> {
  const res = await fetch(`/api/delivery/check?pincode=${encodeURIComponent(pincode)}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Could not check delivery");
  return res.json();
}

/** PIN code checker used in the header, on product pages and on the home page. */
export function DeliveryCheck({ productZoneIds, compact = false, autoFocus = false, onResult }: { productZoneIds?: string[]; compact?: boolean; autoFocus?: boolean; onResult?: (r: DeliveryResult) => void }) {
  const { pincode: saved } = useCart();
  const hydrated = useHydrated();
  const [value, setValue] = useState("");
  const [result, setResult] = useState<DeliveryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const id = useId();

  async function check(pin: string) {
    setError(null);
    if (!/^[1-9]\d{5}$/.test(pin)) {
      setError("Enter a valid 6-digit PIN code.");
      setResult(null);
      return;
    }
    setLoading(true);
    try {
      const r = await fetchDelivery(pin);
      setResult(r);
      cart.setPincode(pin);
      onResult?.(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not check delivery. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // Show the result for a PIN code the customer entered earlier on this device.
  useEffect(() => {
    if (hydrated && saved && !value) {
      setValue(saved);
      void check(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const restricted = result?.serviceable && productZoneIds?.length && result.zone && !productZoneIds.includes(result.zone.id);
  const first = result?.dates?.[0];

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void check(value);
        }}
        className="flex gap-2"
      >
        <label htmlFor={id} className="sr-only">
          Delivery PIN code
        </label>
        <div className="relative flex-1">
          <MapPin aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            id={id}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={6}
            pattern="[0-9]*"
            placeholder="Enter PIN code"
            autoFocus={autoFocus}
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 6))}
            className="field-input pl-9"
            aria-invalid={!!error}
            aria-describedby={`${id}-status`}
          />
        </div>
        <button type="submit" className="btn btn-secondary shrink-0" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Check
        </button>
      </form>
      <div id={`${id}-status`} aria-live="polite" className="mt-2 text-sm">
        {error ? <p className="text-danger">{error}</p> : null}
        {result && !result.serviceable ? (
          <div className="flex gap-2 rounded-xl bg-danger-soft p-3 text-ink-soft">
            <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <p>
              {result.reason === "invalid" ? "This does not look like a valid PIN code." : <>We do not deliver to {result.pincode} yet.</>}{" "}
              {!compact ? (
                <>
                  You can still <Link href="/contact" className="font-semibold text-saffron-dark underline">contact us</Link> or send a{" "}
                  <Link href="/bulk-orders" className="font-semibold text-saffron-dark underline">bulk enquiry</Link>.
                </>
              ) : null}
            </p>
          </div>
        ) : null}
        {result?.serviceable && restricted ? (
          <div className="flex gap-2 rounded-xl bg-danger-soft p-3 text-ink-soft">
            <XCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            <p>We deliver to {result.pincode}, but this item is not available there.</p>
          </div>
        ) : null}
        {result?.serviceable && !restricted ? (
          <div className="flex gap-2 rounded-xl bg-leaf-soft p-3 text-ink-soft">
            <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-leaf" />
            <div>
              <p className="font-semibold text-ink">
                We deliver to {result.pincode}
                {result.localities ? ` (${result.localities})` : ""}
              </p>
              {first ? (
                <p>
                  Earliest delivery: {result.sameDayAvailable ? "today" : formatDeliveryDate(first.date)}
                  {first.slots.find((s) => s.available) ? `, ${first.slots.find((s) => s.available)!.label}` : ""}
                </p>
              ) : (
                <p>No delivery dates are open right now. Please check again later or contact us.</p>
              )}
              {!compact ? (
                <p className="text-muted">
                  Delivery {result.deliveryFeePaise ? formatINR(result.deliveryFeePaise) : "free"}
                  {result.freeDeliveryAbovePaise && result.deliveryFeePaise ? `, free above ${formatINR(result.freeDeliveryAbovePaise)}` : ""}
                  {result.minOrderPaise ? `. Minimum order ${formatINR(result.minOrderPaise)}` : ""}.
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

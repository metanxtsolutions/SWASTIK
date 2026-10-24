"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AlertCircle, Loader2, RefreshCw, Tag, Trash2 } from "lucide-react";
import { cart, useCart, useHydrated } from "@/lib/cart-store";
import { formatINR } from "@/lib/money";
import { illustrationDataUri, illustrationFor } from "@/lib/illustrations";
import { EmptyCart } from "./empty-cart";
import { QuantityStepper } from "./quantity-stepper";
import { useQuote } from "./use-quote";

export function CartView({ checkoutNote }: { checkoutNote: string }) {
  const state = useCart();
  const hydrated = useHydrated();
  const [pinInput, setPinInput] = useState("");
  const [couponInput, setCouponInput] = useState("");
  const { status, quote, error, retry } = useQuote(state.lines, { pincode: state.pincode, couponCode: state.coupon, enabled: hydrated });

  if (!hydrated || (status !== "ready" && status !== "error" && !quote)) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]" aria-busy="true" aria-label="Loading your cart">
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-28" />
          ))}
        </div>
        <div className="skeleton h-72" />
      </div>
    );
  }
  if (!state.lines.length) return <EmptyCart />;
  if (status === "error" && !quote) {
    return (
      <div className="card mx-auto max-w-lg p-6 text-center">
        <AlertCircle aria-hidden className="mx-auto h-8 w-8 text-danger" />
        <p className="mt-2 font-semibold">{error}</p>
        <button type="button" className="btn btn-secondary mt-4" onClick={() => void retry()}>
          <RefreshCw aria-hidden className="h-4 w-4" />
          Try again
        </button>
      </div>
    );
  }
  if (!quote) return null;
  const busy = status === "loading";
  // Missing PIN codes and delivery problems are fixed on the checkout page.
  const hasValid = quote.lines.some((l) => !l.issue);

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem] lg:items-start">
      <section aria-labelledby="cart-items">
        <h2 id="cart-items" className="sr-only">
          Items in your cart
        </h2>
        {error ? (
          <p role="alert" className="mb-3 flex items-center gap-2 rounded-xl bg-danger-soft p-3 text-sm text-ink-soft">
            <AlertCircle aria-hidden className="h-4 w-4 text-danger" />
            {error}
            <button type="button" onClick={() => void retry()} className="ml-auto font-semibold text-saffron-dark underline">
              Retry
            </button>
          </p>
        ) : null}
        <ul className="space-y-3">
          {quote.lines.map((l) => (
            <li key={l.variantId} className="card flex gap-3 p-3 sm:gap-4 sm:p-4">
              <Link href={`/product/${l.slug}`} className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-sand sm:h-24 sm:w-24">
                {l.imageId && l.imageFilename ? (
                  <Image src={`/api/media/${l.imageId}/${l.imageFilename}`} alt="" fill sizes="96px" className="object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={illustrationDataUri(illustrationFor(l.name))} alt="" className="h-full w-full object-cover" />
                )}
              </Link>
              <div className="flex min-w-0 flex-1 flex-col">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/product/${l.slug}`} className="font-semibold leading-snug text-ink hover:text-saffron-dark">
                      {l.name}
                    </Link>
                    <p className="text-sm text-muted">
                      {formatINR(l.unitPricePaise)} {l.unitText}
                      {l.unitPricePaise < l.regularPricePaise ? <s className="ml-1">{formatINR(l.regularPricePaise)}</s> : null}
                    </p>
                  </div>
                  <p className="shrink-0 font-bold">{formatINR(l.lineTotalPaise)}</p>
                </div>
                <div className="mt-auto flex items-center justify-between gap-2 pt-2">
                  <QuantityStepper size="sm" value={l.quantity} min={l.minOrderQty} max={l.maxOrderQty ?? undefined} onChange={(n) => cart.setQuantity(l.variantId, n < l.minOrderQty ? 0 : n)} label={`Quantity of ${l.name}`} />
                  <button type="button" onClick={() => cart.remove(l.variantId)} className="inline-flex h-9 items-center gap-1 rounded-full px-2 text-sm text-muted hover:bg-sand hover:text-danger" aria-label={`Remove ${l.name}`}>
                    <Trash2 aria-hidden className="h-4 w-4" />
                    <span className="hidden sm:inline">Remove</span>
                  </button>
                </div>
                {l.issue ? (
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-danger">
                    <AlertCircle aria-hidden className="h-4 w-4" />
                    {l.issue}
                    {l.maxOrderQty && l.quantity > l.maxOrderQty ? (
                      <button type="button" onClick={() => cart.setQuantity(l.variantId, l.maxOrderQty!)} className="ml-1 underline">
                        Set to {l.maxOrderQty}
                      </button>
                    ) : null}
                  </p>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <Link href="/shop" className="btn btn-ghost mt-3">
          Continue shopping
        </Link>
      </section>

      <aside aria-labelledby="summary-title" className="card space-y-4 p-5 lg:sticky lg:top-40">
        <h2 id="summary-title" className="text-xl font-semibold">
          Order summary
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const v = pinInput.trim();
            if (/^[1-9]\d{5}$/.test(v)) cart.setPincode(v);
          }}
        >
          <label htmlFor="cart-pin" className="field-label">
            Delivery PIN code
          </label>
          <div className="flex gap-2">
            <input id="cart-pin" inputMode="numeric" maxLength={6} placeholder={state.pincode || "6-digit PIN"} value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))} className="field-input" />
            <button className="btn btn-secondary" type="submit">
              {state.pincode ? "Change" : "Check"}
            </button>
          </div>
          {quote.delivery ? (
            <p className={`mt-2 text-sm ${quote.delivery.serviceable ? "text-leaf" : "text-danger"}`}>
              {quote.delivery.serviceable ? `Delivering to ${quote.delivery.pincode} (${quote.delivery.zoneName})` : `We do not deliver to ${quote.delivery.pincode} yet.`}
            </p>
          ) : (
            <p className="field-hint">Enter your PIN code to see the delivery charge.</p>
          )}
        </form>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            cart.setCoupon(couponInput.trim().toUpperCase());
          }}
        >
          <label htmlFor="cart-coupon" className="field-label">
            Promo code
          </label>
          {quote.coupon ? (
            <p className="flex items-center justify-between rounded-xl bg-leaf-soft px-3 py-2 text-sm">
              <span className="inline-flex items-center gap-1.5 font-semibold text-leaf">
                <Tag aria-hidden className="h-4 w-4" />
                {quote.coupon.code} applied
              </span>
              <button type="button" className="font-semibold text-muted underline" onClick={() => cart.setCoupon("")}>
                Remove
              </button>
            </p>
          ) : (
            <>
              <div className="flex gap-2">
                <input id="cart-coupon" value={couponInput} onChange={(e) => setCouponInput(e.target.value)} placeholder="Enter code" className="field-input uppercase" autoCapitalize="characters" />
                <button className="btn btn-secondary" type="submit">
                  Apply
                </button>
              </div>
              {state.coupon && quote.couponError ? <p className="field-error">{quote.couponError}</p> : null}
            </>
          )}
        </form>
        <dl className="space-y-2 border-t border-line pt-4 text-sm">
          <div className="flex justify-between">
            <dt>Items</dt>
            <dd>{formatINR(quote.itemsSubtotalPaise)}</dd>
          </div>
          {quote.discountPaise ? (
            <div className="flex justify-between text-leaf">
              <dt>Discount</dt>
              <dd>-{formatINR(quote.discountPaise)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>Delivery</dt>
            <dd>{quote.delivery?.serviceable ? (quote.deliveryFeePaise ? formatINR(quote.deliveryFeePaise) : "Free") : "Add PIN code"}</dd>
          </div>
          {quote.delivery?.serviceable && quote.delivery.freeDeliveryAbovePaise && quote.deliveryFeePaise ? (
            <p className="text-xs text-muted">Free delivery on orders of {formatINR(quote.delivery.freeDeliveryAbovePaise)} or more.</p>
          ) : null}
          <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
            <dt>Total</dt>
            <dd>{formatINR(quote.totalPaise)}</dd>
          </div>
        </dl>
        {quote.issues.filter((i) => i !== "Your cart is empty.").length ? (
          <ul className="space-y-1 rounded-xl bg-danger-soft p-3 text-sm text-ink-soft">
            {quote.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
        ) : null}
        {checkoutNote ? <p className="text-xs text-muted">{checkoutNote}</p> : null}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
          <Link href="/checkout" aria-disabled={!hasValid} className={`btn btn-primary w-full text-base ${!hasValid ? "pointer-events-none opacity-55" : ""}`}>
            {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
            Checkout · {formatINR(quote.totalPaise)}
          </Link>
        </div>
      </aside>
    </div>
  );
}

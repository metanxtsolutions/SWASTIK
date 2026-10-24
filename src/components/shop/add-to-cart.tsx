"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Check, ShoppingBag, Zap } from "lucide-react";
import type { VariantView } from "@/server/services/catalog";
import { cart, showToast, useCart, useHydrated } from "@/lib/cart-store";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/money";
import { QuantityStepper } from "./quantity-stepper";

export function AddToCart({ productName, variants }: { productName: string; variants: VariantView[] }) {
  const router = useRouter();
  const state = useCart();
  const hydrated = useHydrated();
  const firstAvailable = variants.find((v) => v.available) ?? variants[0];
  const [variantId, setVariantId] = useState(firstAvailable?.id);
  const variant = variants.find((v) => v.id === variantId) ?? firstAvailable;
  const [qty, setQty] = useState(variant?.minOrderQty ?? 1);
  const inCart = hydrated ? (state.lines.find((l) => l.variantId === variant?.id)?.quantity ?? 0) : 0;
  const max = useMemo(() => (variant?.maxOrderQty != null ? Math.max(variant.maxOrderQty - inCart, 0) : null), [variant, inCart]);

  if (!variant) return null;
  const quantity = Math.max(qty, variant.minOrderQty);
  const canAdd = variant.available && (max === null || max >= quantity);

  function add(goToCheckout: boolean) {
    if (!canAdd) return;
    cart.add(variant.id, quantity);
    if (goToCheckout) router.push("/checkout");
    else showToast(`${productName}${variant.label ? ` (${variant.label})` : ""} added to cart`, { label: "View cart", href: "/cart" });
  }

  return (
    <div className="space-y-5">
      <div aria-live="polite">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-3xl font-bold text-ink">{formatINR(variant.pricePaise)}</span>
          {variant.onSale ? <s className="text-lg text-muted">{formatINR(variant.regularPricePaise)}</s> : null}
          <span className="text-base text-ink-soft">{variant.unitText}</span>
        </p>
        {quantity > 1 ? (
          <p className="mt-1 text-sm text-muted">
            {quantity} × {formatINR(variant.pricePaise)} = <span className="font-semibold text-ink">{formatINR(variant.pricePaise * quantity)}</span>
          </p>
        ) : null}
      </div>

      {variants.length > 1 ? (
        <fieldset>
          <legend className="field-label">Choose an option</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <label key={v.id} className={cn("relative flex min-h-12 cursor-pointer flex-col justify-center rounded-2xl border px-4 py-2 text-sm transition", v.id === variant.id ? "border-saffron bg-saffron-soft ring-1 ring-saffron" : "border-line bg-paper hover:border-saffron", !v.available && "opacity-60")}>
                <input
                  type="radio"
                  name="variant"
                  value={v.id}
                  checked={v.id === variant.id}
                  onChange={() => {
                    setVariantId(v.id);
                    setQty(v.minOrderQty);
                  }}
                  className="sr-only"
                />
                <span className="font-semibold text-ink">{v.label || "Standard"}</span>
                <span className="text-muted">
                  {formatINR(v.pricePaise)}
                  {!v.available ? ", out of stock" : ""}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper value={quantity} min={variant.minOrderQty} max={max ?? undefined} onChange={(n) => setQty(Math.max(n, variant.minOrderQty))} label="Quantity" disabled={!variant.available} />
        <p className="text-sm text-muted">
          {variant.minOrderQty > 1 ? `Minimum ${variant.minOrderQty}. ` : ""}
          {variant.lowStock !== null ? <span className="font-semibold text-kumkum">Only {variant.lowStock} left. </span> : null}
          {inCart ? (
            <span className="inline-flex items-center gap-1 text-leaf">
              <Check aria-hidden className="h-4 w-4" />
              {inCart} in your cart
            </span>
          ) : null}
        </p>
      </div>

      {!variant.available ? (
        <p className="rounded-xl bg-sand p-3 text-sm font-medium text-ink-soft">This option is out of stock right now.</p>
      ) : max !== null && max < quantity ? (
        <p className="rounded-xl bg-sand p-3 text-sm font-medium text-ink-soft">You already have the maximum available quantity in your cart.</p>
      ) : null}

      {/* On phones these buttons stay at the bottom of the screen. */}
      <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t border-line bg-paper/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur md:static md:z-auto md:border-0 md:bg-transparent md:p-0">
        <button type="button" onClick={() => add(false)} disabled={!canAdd} className="btn btn-primary flex-1 text-base md:flex-none md:px-8">
          <ShoppingBag aria-hidden className="h-5 w-5" />
          Add to cart
        </button>
        <button type="button" onClick={() => add(true)} disabled={!canAdd} className="btn btn-secondary flex-1 text-base md:flex-none md:px-8">
          <Zap aria-hidden className="h-5 w-5" />
          Buy now
        </button>
      </div>
    </div>
  );
}

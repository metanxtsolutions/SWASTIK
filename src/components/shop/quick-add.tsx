"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { cart, showToast, useCart, useHydrated } from "@/lib/cart-store";
import { QuantityStepper } from "./quantity-stepper";

/** Add button on product cards: adds single-option products directly, otherwise opens the product. */
export function QuickAdd({ productSlug, productName, variantId, minQty, inStock, variantCount }: { productSlug: string; productName: string; variantId: string | null; minQty: number; inStock: boolean; variantCount: number }) {
  const state = useCart();
  const hydrated = useHydrated();
  if (!inStock) {
    return (
      <span className="inline-flex h-9 items-center rounded-full bg-sand px-3 text-xs font-semibold text-muted" aria-label={`${productName} is out of stock`}>
        Out of stock
      </span>
    );
  }
  if (!variantId || variantCount > 1) {
    return (
      <Link href={`/product/${productSlug}`} className="btn btn-secondary btn-sm" aria-label={`Choose options for ${productName}`}>
        Choose
      </Link>
    );
  }
  const inCart = hydrated ? state.lines.find((l) => l.variantId === variantId)?.quantity ?? 0 : 0;
  if (inCart > 0) {
    return <QuantityStepper size="sm" value={inCart} min={minQty} label={`Quantity of ${productName} in cart`} onChange={(n) => cart.setQuantity(variantId, n < minQty ? 0 : n)} />;
  }
  return (
    <button
      type="button"
      className="btn btn-primary btn-sm"
      aria-label={`Add ${productName} to cart`}
      onClick={() => {
        cart.add(variantId, minQty);
        showToast(`${productName} added to cart`, { label: "View cart", href: "/cart" });
      }}
    >
      <Plus aria-hidden className="h-4 w-4" />
      Add
    </button>
  );
}

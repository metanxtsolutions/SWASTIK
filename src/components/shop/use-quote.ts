"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Quote } from "@/server/services/pricing";
import { cart, type CartLine } from "@/lib/cart-store";

export type QuoteState = { status: "idle" | "loading" | "ready" | "error"; quote: Quote | null; error: string | null };

/** Fetches server-side pricing for the browser cart whenever it changes. */
export function useQuote(lines: CartLine[], opts: { pincode?: string; couponCode?: string; phone?: string; enabled?: boolean }) {
  const [state, setState] = useState<QuoteState>({ status: "idle", quote: null, error: null });
  const seq = useRef(0);
  const key = JSON.stringify([lines.map((l) => [l.variantId, l.quantity]), opts.pincode ?? "", opts.couponCode ?? "", opts.phone ?? ""]);

  const run = useCallback(async () => {
    const id = ++seq.current;
    if (!lines.length) {
      setState({ status: "ready", quote: null, error: null });
      return;
    }
    setState((s) => ({ ...s, status: "loading", error: null }));
    try {
      const res = await fetch("/api/cart/quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lines: lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })), pincode: opts.pincode || null, couponCode: opts.couponCode || null, phone: opts.phone || null }),
      });
      const body = await res.json().catch(() => null);
      if (id !== seq.current) return;
      if (!res.ok || !body) throw new Error(body?.error ?? "We could not load your cart.");
      const quote = body as Quote;
      // Items that are no longer sold are removed from the stored cart.
      if (quote.missingVariantIds.length) cart.removeMany(quote.missingVariantIds);
      setState({ status: "ready", quote, error: null });
    } catch (e) {
      if (id !== seq.current) return;
      setState((s) => ({ status: "error", quote: s.quote, error: e instanceof Error && e.message !== "Failed to fetch" ? e.message : "You seem to be offline. Check your connection and try again." }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    if (opts.enabled === false) return;
    const t = setTimeout(run, 150);
    return () => clearTimeout(t);
  }, [run, opts.enabled]);

  return { ...state, retry: run };
}

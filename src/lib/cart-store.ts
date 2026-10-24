"use client";

import { useSyncExternalStore } from "react";

/**
 * The guest cart lives in this browser's localStorage, so it survives closing
 * the tab without an account. It holds only variant ids and quantities: names,
 * prices and stock always come from the server when the cart is shown.
 */

export interface CartLine {
  variantId: string;
  quantity: number;
  addedAt: number;
}

interface CartState {
  lines: CartLine[];
  pincode: string;
  coupon: string;
}

const KEY = "swastik.cart.v1";
const EMPTY: CartState = { lines: [], pincode: "", coupon: "" };
const MAX_LINES = 50;

let state: CartState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

function load(): CartState {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const parsed = JSON.parse(raw) as Partial<CartState>;
    const lines = Array.isArray(parsed.lines)
      ? parsed.lines
          .filter((l): l is CartLine => !!l && typeof l.variantId === "string" && /^[0-9a-f-]{36}$/i.test(l.variantId) && Number.isInteger(l.quantity) && l.quantity > 0)
          .slice(0, MAX_LINES)
          .map((l) => ({ variantId: l.variantId, quantity: Math.min(l.quantity, 1000), addedAt: Number(l.addedAt) || Date.now() }))
      : [];
    return { lines, pincode: typeof parsed.pincode === "string" && /^\d{6}$/.test(parsed.pincode) ? parsed.pincode : "", coupon: typeof parsed.coupon === "string" ? parsed.coupon.slice(0, 40) : "" };
  } catch {
    return EMPTY;
  }
}

function ensureLoaded() {
  if (!loaded && typeof window !== "undefined") {
    state = load();
    loaded = true;
    window.addEventListener("storage", (e) => {
      if (e.key === KEY) {
        state = load();
        listeners.forEach((l) => l());
      }
    });
  }
}

function save(next: CartState) {
  state = next;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Private browsing or full storage: the cart still works for this visit.
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  ensureLoaded();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  ensureLoaded();
  return state;
}

function getServerSnapshot() {
  return EMPTY;
}

export function useCart() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True after the first client render, so server HTML and the stored cart do not mismatch. */
export function useHydrated() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
}

export const cart = {
  add(variantId: string, quantity: number) {
    ensureLoaded();
    const existing = state.lines.find((l) => l.variantId === variantId);
    const lines = existing
      ? state.lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(l.quantity + quantity, 1000) } : l))
      : [...state.lines, { variantId, quantity, addedAt: Date.now() }].slice(-MAX_LINES);
    save({ ...state, lines });
  },
  setQuantity(variantId: string, quantity: number) {
    ensureLoaded();
    const lines = quantity <= 0 ? state.lines.filter((l) => l.variantId !== variantId) : state.lines.map((l) => (l.variantId === variantId ? { ...l, quantity: Math.min(quantity, 1000) } : l));
    save({ ...state, lines });
  },
  remove(variantId: string) {
    ensureLoaded();
    save({ ...state, lines: state.lines.filter((l) => l.variantId !== variantId) });
  },
  removeMany(variantIds: string[]) {
    ensureLoaded();
    if (!variantIds.length) return;
    save({ ...state, lines: state.lines.filter((l) => !variantIds.includes(l.variantId)) });
  },
  clear() {
    ensureLoaded();
    save({ ...state, lines: [], coupon: "" });
  },
  setPincode(pincode: string) {
    ensureLoaded();
    save({ ...state, pincode });
  },
  setCoupon(coupon: string) {
    ensureLoaded();
    save({ ...state, coupon });
  },
  count(s: CartState = state) {
    return s.lines.reduce((n, l) => n + l.quantity, 0);
  },
};

/** Lightweight toast messages for cart actions. */
export type ToastMessage = { id: number; text: string; action?: { label: string; href: string } };
const toastListeners = new Set<(t: ToastMessage) => void>();
let toastId = 0;

export function showToast(text: string, action?: ToastMessage["action"]) {
  const t = { id: ++toastId, text, action };
  toastListeners.forEach((l) => l(t));
}

export function onToast(listener: (t: ToastMessage) => void) {
  toastListeners.add(listener);
  return () => {
    toastListeners.delete(listener);
  };
}

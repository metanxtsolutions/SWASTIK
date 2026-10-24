"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Home, LayoutGrid, MapPin, Search, ShoppingBag, Building2, X } from "lucide-react";
import { cart, onToast, useCart, useHydrated, type ToastMessage } from "@/lib/cart-store";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/money";
import { DeliveryCheck } from "./delivery-check";

export function CartButton({ className }: { className?: string }) {
  const state = useCart();
  const hydrated = useHydrated();
  const count = hydrated ? cart.count(state) : 0;
  return (
    <Link href="/cart" className={cn("relative inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-full px-3 font-semibold text-ink hover:bg-sand", className)} aria-label={count ? `Cart, ${count} item${count === 1 ? "" : "s"}` : "Cart, empty"}>
      <ShoppingBag aria-hidden className="h-5 w-5" />
      <span className="hidden lg:inline">Cart</span>
      {count > 0 ? (
        <span aria-hidden className="absolute right-0.5 top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-saffron px-1 text-[0.7rem] font-bold text-white lg:static">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}

interface Suggestion {
  slug: string;
  name: string;
  pricePaise: number;
  unitText: string;
}

export function SearchBox({ className, id = "site-search" }: { className?: string; id?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) setItems(((await res.json()) as { items: Suggestion[] }).items);
      } catch {
        // Typing ahead is optional; the full search page still works.
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const showList = open && items.length > 0;
  return (
    <div ref={boxRef} className={cn("relative", className)}>
      <form
        role="search"
        action="/search"
        onSubmit={(e) => {
          e.preventDefault();
          if (active >= 0 && items[active]) router.push(`/product/${items[active].slug}`);
          else if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
          setOpen(false);
        }}
      >
        <label htmlFor={id} className="sr-only">
          Search flowers
        </label>
        <Search aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-muted" />
        <input
          id={id}
          name="q"
          type="search"
          role="combobox"
          aria-expanded={showList}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          autoComplete="off"
          placeholder="Search marigold, garlands, bel patra…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, -1));
            } else if (e.key === "Escape") setOpen(false);
          }}
          className="h-11 w-full rounded-full border border-line bg-paper pl-10 pr-4 text-ink placeholder:text-muted focus:border-saffron focus:outline-none focus:ring-3 focus:ring-saffron/20"
        />
      </form>
      {showList ? (
        <ul id={`${id}-list`} role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-line bg-paper py-1 shadow-[var(--shadow-float)]">
          {items.map((s, i) => (
            <li key={s.slug} id={`${id}-opt-${i}`} role="option" aria-selected={i === active}>
              <Link href={`/product/${s.slug}`} onClick={() => setOpen(false)} className={cn("flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-sand", i === active && "bg-sand")}>
                <span className="font-medium text-ink">{s.name}</span>
                <span className="shrink-0 text-muted">
                  {formatINR(s.pricePaise)} {s.unitText}
                </span>
              </Link>
            </li>
          ))}
          <li role="option" aria-selected={false}>
            <Link href={`/search?q=${encodeURIComponent(q.trim())}`} onClick={() => setOpen(false)} className="block border-t border-line px-4 py-2.5 text-sm font-semibold text-saffron-dark hover:bg-sand">
              See all results for “{q.trim()}”
            </Link>
          </li>
        </ul>
      ) : null}
    </div>
  );
}

export function PincodeChip() {
  const { pincode } = useCart();
  const hydrated = useHydrated();
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex h-11 min-w-0 max-w-[8.75rem] items-center gap-1.5 rounded-full px-2 text-left text-sm hover:bg-sand sm:max-w-[11rem] sm:px-3">
        <MapPin aria-hidden className="h-4.5 w-4.5 shrink-0 text-saffron" />
        <span className="flex min-w-0 flex-col leading-tight">
          <span className="text-[0.7rem] text-muted">Deliver to</span>
          <span className="truncate font-semibold text-ink">{hydrated && pincode ? pincode : "Enter PIN"}</span>
        </span>
      </button>
      <dialog ref={dialogRef} onClose={() => setOpen(false)} aria-labelledby="pin-dialog-title" className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-paper p-0 text-ink shadow-[var(--shadow-float)] backdrop:bg-ink/40">
        <div className="p-5">
          <div className="mb-3 flex items-start justify-between gap-4">
            <div>
              <h2 id="pin-dialog-title" className="text-xl font-semibold">
                Check delivery
              </h2>
              <p className="text-sm text-muted">Enter your PIN code to see if we deliver to you and when.</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="-mr-2 -mt-1 inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-sand" aria-label="Close">
              <X aria-hidden className="h-5 w-5" />
            </button>
          </div>
          {open ? <DeliveryCheck autoFocus /> : null}
        </div>
      </dialog>
    </>
  );
}

/** Bottom navigation on phones. Hidden where a page has its own sticky action bar. */
export function MobileNav() {
  const pathname = usePathname();
  const state = useCart();
  const hydrated = useHydrated();
  const count = hydrated ? cart.count(state) : 0;
  if (/^\/(product|cart|checkout|pay)(\/|$)/.test(pathname)) return null;
  const items = [
    { href: "/", label: "Home", icon: Home, match: (p: string) => p === "/" },
    { href: "/shop", label: "Shop", icon: LayoutGrid, match: (p: string) => p.startsWith("/shop") || p.startsWith("/category") || p.startsWith("/collections") || p.startsWith("/search") },
    { href: "/bulk-orders", label: "Bulk orders", icon: Building2, match: (p: string) => p.startsWith("/bulk-orders") },
    { href: "/cart", label: "Cart", icon: ShoppingBag, match: (p: string) => p.startsWith("/cart") },
  ];
  return (
    <>
      <div aria-hidden className="h-16 md:hidden" />
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-4">
          {items.map((it) => {
            const active = it.match(pathname);
            const Icon = it.icon;
            return (
              <li key={it.href}>
                <Link href={it.href} aria-current={active ? "page" : undefined} className={cn("relative flex h-16 flex-col items-center justify-center gap-1 text-[0.7rem] font-medium", active ? "text-saffron-dark" : "text-muted")}>
                  <Icon aria-hidden className="h-5 w-5" />
                  {it.label}
                  {it.href === "/cart" && count > 0 ? (
                    <span className="absolute left-1/2 top-2 ml-2 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-saffron px-1 text-[0.65rem] font-bold text-white">{count > 99 ? "99+" : count}</span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

export function Toaster() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  useEffect(
    () =>
      onToast((t) => {
        setToasts((all) => [...all.slice(-2), t]);
        setTimeout(() => setToasts((all) => all.filter((x) => x.id !== t.id)), 4000);
      }),
    [],
  );
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto flex w-full max-w-md items-center justify-between gap-3 rounded-2xl bg-ink px-4 py-3 text-sm text-white shadow-[var(--shadow-float)] [animation:toast-in_.2s_ease-out]">
          <span>{t.text}</span>
          {t.action ? (
            <Link href={t.action.href} className="shrink-0 font-semibold text-marigold underline-offset-2 hover:underline">
              {t.action.label}
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}

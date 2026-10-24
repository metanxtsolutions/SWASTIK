"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CreditCard, Loader2, Lock, Wallet } from "lucide-react";
import { cart, useCart, useHydrated } from "@/lib/cart-store";
import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/money";
import { formatDeliveryDate } from "@/lib/dates";
import { fetchDelivery, type DeliveryResult } from "./delivery-check";
import { EmptyCart } from "./empty-cart";
import { useQuote } from "./use-quote";
import { openPayment } from "./payment-launcher";

export interface CheckoutOptions {
  online: boolean;
  onlineIsTest: boolean;
  cod: boolean;
  codMaxOrderPaise: number | null;
  acceptingOrders: boolean;
  pausedMessage: string;
  whatsappAvailable: boolean;
  checkoutNote: string;
  defaultCity: string;
  termsHref: string | null;
}

type Fields = {
  customerName: string;
  phone: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  landmark: string;
  locality: string;
  city: string;
  pincode: string;
  notes: string;
};

const IDEMPOTENCY_KEY = "swastik.checkout.key";

function idempotencyKey(): string {
  try {
    const existing = sessionStorage.getItem(IDEMPOTENCY_KEY);
    if (existing) return existing;
    const k = crypto.randomUUID();
    sessionStorage.setItem(IDEMPOTENCY_KEY, k);
    return k;
  } catch {
    return crypto.randomUUID();
  }
}

function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : hint ? (
        <p className="field-hint">{hint}</p>
      ) : null}
    </div>
  );
}

export function CheckoutForm({ options }: { options: CheckoutOptions }) {
  const router = useRouter();
  const state = useCart();
  const hydrated = useHydrated();
  const [f, setF] = useState<Fields>({ customerName: "", phone: "", email: "", addressLine1: "", addressLine2: "", landmark: "", locality: "", city: options.defaultCity, pincode: "", notes: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [delivery, setDelivery] = useState<DeliveryResult | null>(null);
  const [deliveryLoading, setDeliveryLoading] = useState(false);
  const [date, setDate] = useState("");
  const [slotId, setSlotId] = useState("");
  const [method, setMethod] = useState<"online" | "cod" | "">(options.online ? "online" : options.cod ? "cod" : "");
  const [whatsapp, setWhatsapp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const errorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hydrated && state.pincode && !f.pincode) setF((x) => ({ ...x, pincode: state.pincode }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);

  const validPin = /^[1-9]\d{5}$/.test(f.pincode);
  const phoneDigits = f.phone.replace(/\D/g, "").slice(-10);
  const quote = useQuote(state.lines, { pincode: validPin ? f.pincode : "", couponCode: state.coupon, phone: phoneDigits.length === 10 ? phoneDigits : "", enabled: hydrated });

  // Load delivery dates and slots for the PIN code.
  useEffect(() => {
    if (!validPin) {
      setDelivery(null);
      return;
    }
    let cancelled = false;
    setDeliveryLoading(true);
    fetchDelivery(f.pincode)
      .then((r) => {
        if (cancelled) return;
        setDelivery(r);
        cart.setPincode(f.pincode);
        const first = r.dates?.[0];
        setDate((d) => (r.dates?.some((x) => x.date === d) ? d : (first?.date ?? "")));
      })
      .catch(() => !cancelled && setDelivery(null))
      .finally(() => !cancelled && setDeliveryLoading(false));
    return () => {
      cancelled = true;
    };
  }, [f.pincode, validPin]);

  const dateOption = delivery?.dates?.find((d) => d.date === date);
  useEffect(() => {
    if (!dateOption) return setSlotId("");
    if (!dateOption.slots.find((s) => s.id === slotId && s.available)) setSlotId(dateOption.slots.find((s) => s.available)?.id ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, delivery]);

  const q = quote.quote;
  const codAllowed = options.cod && (options.codMaxOrderPaise === null || !q || q.totalPaise <= options.codMaxOrderPaise);
  const noPayment = !options.online && !options.cod;
  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: k === "pincode" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value }));
  const inputProps = (k: keyof Fields) => ({ id: `co-${k}`, name: k, value: f[k], onChange: set(k), "aria-invalid": !!errors[k], "aria-describedby": errors[k] ? `co-${k}-error` : undefined, className: "field-input" });

  const blocking = useMemo(() => {
    if (!options.acceptingOrders) return options.pausedMessage;
    if (noPayment) return "Online ordering is not open yet. Please contact us to place your order.";
    if (q && q.lines.some((l) => l.issue)) return "Some items in your cart need attention.";
    if (validPin && delivery && !delivery.serviceable) return `We do not deliver to ${f.pincode} yet.`;
    if (validPin && delivery?.serviceable && !delivery.dates?.length) return "No delivery dates are open for your area right now.";
    const minimum = q?.issues.find((i) => i.startsWith("The minimum order"));
    if (minimum) return `${minimum} Add a little more to your cart.`;
    return null;
  }, [options, noPayment, q, validPin, delivery, f.pincode]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting || !q) return;
    setFormError(null);
    const errs: Record<string, string> = {};
    if (f.customerName.trim().length < 2) errs.customerName = "Enter your name";
    if (phoneDigits.length !== 10 || !/^[6-9]/.test(phoneDigits)) errs.phone = "Enter a valid 10-digit mobile number";
    if (f.addressLine1.trim().length < 5) errs.addressLine1 = "Enter your house or flat number and street";
    if (f.locality.trim().length < 2) errs.locality = "Enter your locality";
    if (f.city.trim().length < 2) errs.city = "Enter your town or city";
    if (!validPin) errs.pincode = "Enter a valid 6-digit PIN code";
    if (!date) errs.deliveryDate = "Choose a delivery date";
    if (dateOption?.slots.length && !slotId) errs.slotId = "Choose a time slot";
    if (!method) errs.paymentMethod = "Choose how you will pay";
    setErrors(errs);
    if (Object.keys(errs).length) {
      setFormError("Please check the highlighted details.");
      errorRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey: idempotencyKey(),
          lines: state.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity })),
          ...f,
          deliveryDate: date,
          slotId: slotId || null,
          paymentMethod: method,
          couponCode: state.coupon,
          whatsappConsent: whatsapp,
          expectedTotalPaise: q.totalPaise,
          website: (document.getElementById("co-website") as HTMLInputElement | null)?.value ?? "",
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        setErrors(body?.fieldErrors ?? {});
        setFormError(body?.error ?? "We could not place your order. Please try again.");
        // Prices or stock changed: reload the totals so the customer can review them.
        if (res.status === 409) void quote.retry();
        errorRef.current?.focus();
        setSubmitting(false);
        return;
      }
      // The order exists now: the cart becomes the order, and a new checkout gets a new key.
      try {
        sessionStorage.removeItem(IDEMPOTENCY_KEY);
      } catch {}
      cart.clear();
      const orderUrl = `/order/${body.orderNumber}?t=${encodeURIComponent(body.token)}`;
      if (body.paymentMethod === "online") {
        await openPayment({ orderNumber: body.orderNumber, token: body.token, router, orderUrl });
      } else {
        router.push(orderUrl);
      }
    } catch {
      setFormError("Your connection dropped before we could confirm the order. Please press Place order again: you will not be charged twice.");
      setSubmitting(false);
      errorRef.current?.focus();
    }
  }

  if (!hydrated) return <div className="skeleton h-96" aria-busy="true" />;
  if (!state.lines.length) return <EmptyCart />;

  return (
    <form onSubmit={submit} noValidate className="grid gap-6 lg:grid-cols-[1fr_24rem] lg:items-start">
      <div className="space-y-5">
        <div ref={errorRef} tabIndex={-1} aria-live="assertive" className="outline-none">
          {formError ? (
            <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm font-medium text-ink">
              <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
              {formError}
            </p>
          ) : null}
        </div>

        <fieldset className="card space-y-4 p-4 sm:p-5">
          <legend className="sr-only">Your details</legend>
          <h2 className="text-xl font-semibold" aria-hidden>
            1. Your details
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="co-customerName" label="Full name" error={errors.customerName}>
              <input {...inputProps("customerName")} autoComplete="name" required />
            </Field>
            <Field id="co-phone" label="Mobile number" error={errors.phone} hint="We call or message this number about your delivery.">
              <input {...inputProps("phone")} type="tel" inputMode="tel" autoComplete="tel-national" placeholder="10-digit mobile" required />
            </Field>
          </div>
          <Field id="co-email" label="Email (optional)" error={errors.email} hint="For your order confirmation and updates.">
            <input {...inputProps("email")} type="email" autoComplete="email" inputMode="email" />
          </Field>
        </fieldset>

        <fieldset className="card space-y-4 p-4 sm:p-5">
          <legend className="sr-only">Delivery address</legend>
          <h2 className="text-xl font-semibold" aria-hidden>
            2. Delivery address
          </h2>
          <Field id="co-pincode" label="PIN code" error={errors.pincode}>
            <input {...inputProps("pincode")} inputMode="numeric" autoComplete="postal-code" maxLength={6} required className="field-input max-w-[12rem]" />
          </Field>
          {deliveryLoading ? (
            <p className="flex items-center gap-2 text-sm text-muted">
              <Loader2 aria-hidden className="h-4 w-4 animate-spin" />
              Checking delivery…
            </p>
          ) : delivery && !delivery.serviceable ? (
            <p className="rounded-xl bg-danger-soft p-3 text-sm text-ink-soft">
              We do not deliver to {f.pincode} yet. Try another PIN code, <Link href="/contact" className="font-semibold text-saffron-dark underline">contact us</Link>, or send a{" "}
              <Link href="/bulk-orders" className="font-semibold text-saffron-dark underline">bulk enquiry</Link>.
            </p>
          ) : delivery?.serviceable ? (
            <p className="text-sm text-leaf">We deliver to {f.pincode}{delivery.localities ? ` (${delivery.localities})` : ""}.</p>
          ) : null}
          <Field id="co-addressLine1" label="House or flat number, building and street" error={errors.addressLine1}>
            <input {...inputProps("addressLine1")} autoComplete="address-line1" required />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="co-locality" label="Locality or area" error={errors.locality}>
              <input {...inputProps("locality")} autoComplete="address-level3" required />
            </Field>
            <Field id="co-city" label="Town or city" error={errors.city}>
              <input {...inputProps("city")} autoComplete="address-level2" required />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="co-landmark" label="Landmark (optional)" error={errors.landmark}>
              <input {...inputProps("landmark")} />
            </Field>
            <Field id="co-addressLine2" label="More address details (optional)" error={errors.addressLine2}>
              <input {...inputProps("addressLine2")} autoComplete="address-line2" />
            </Field>
          </div>
        </fieldset>

        <fieldset className="card space-y-4 p-4 sm:p-5" aria-describedby={errors.deliveryDate ? "co-date-error" : undefined}>
          <legend className="sr-only">Delivery date and time</legend>
          <h2 className="text-xl font-semibold" aria-hidden>
            3. Delivery date and time
          </h2>
          {!validPin ? (
            <p className="text-sm text-muted">Enter your PIN code above to see available dates.</p>
          ) : delivery?.serviceable && delivery.dates?.length ? (
            <>
              <div role="radiogroup" aria-label="Delivery date" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {delivery.dates.map((d) => (
                  <button key={d.date} type="button" role="radio" aria-checked={d.date === date} onClick={() => setDate(d.date)} className={cn("flex min-h-14 min-w-[5.5rem] shrink-0 flex-col items-center justify-center rounded-2xl border px-3 text-sm", d.date === date ? "border-saffron bg-saffron-soft font-semibold ring-1 ring-saffron" : "border-line bg-paper hover:border-saffron")}>
                    {formatDeliveryDate(d.date)}
                  </button>
                ))}
              </div>
              {errors.deliveryDate ? (
                <p id="co-date-error" className="field-error">
                  {errors.deliveryDate}
                </p>
              ) : null}
              {dateOption?.slots.length ? (
                <div role="radiogroup" aria-label="Time slot" className="grid gap-2 sm:grid-cols-2">
                  {dateOption.slots.map((s) => (
                    <label key={s.id} className={cn("flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-2 text-sm", !s.available ? "cursor-not-allowed border-line bg-sand/60 text-muted" : s.id === slotId ? "cursor-pointer border-saffron bg-saffron-soft ring-1 ring-saffron" : "cursor-pointer border-line bg-paper hover:border-saffron")}>
                      <input type="radio" name="slot" value={s.id} checked={s.id === slotId} disabled={!s.available} onChange={() => setSlotId(s.id)} className="h-4 w-4 accent-[var(--color-saffron)]" />
                      <span>
                        <span className="font-semibold">{s.label}</span>
                        {!s.available ? <span className="block text-xs">{s.reason ?? "Not available"}</span> : null}
                      </span>
                    </label>
                  ))}
                </div>
              ) : null}
              {errors.slotId ? <p className="field-error">{errors.slotId}</p> : null}
            </>
          ) : delivery?.serviceable ? (
            <p className="rounded-xl bg-sand p-3 text-sm">No delivery dates are open for your area right now. Please check again later or contact us.</p>
          ) : null}
        </fieldset>

        <fieldset className="card space-y-3 p-4 sm:p-5">
          <legend className="sr-only">Payment</legend>
          <h2 className="text-xl font-semibold" aria-hidden>
            4. Payment
          </h2>
          {noPayment ? <p className="rounded-xl bg-sand p-3 text-sm">Online ordering is not open yet. Please contact us to place your order.</p> : null}
          {options.online ? (
            <label className={cn("flex cursor-pointer items-start gap-3 rounded-2xl border p-4", method === "online" ? "border-saffron bg-saffron-soft ring-1 ring-saffron" : "border-line bg-paper")}>
              <input type="radio" name="paymentMethod" value="online" checked={method === "online"} onChange={() => setMethod("online")} className="mt-1 h-4 w-4 accent-[var(--color-saffron)]" />
              <span>
                <span className="flex items-center gap-2 font-semibold">
                  <CreditCard aria-hidden className="h-4 w-4" />
                  Pay online {options.onlineIsTest ? <span className="chip bg-info-soft text-info">Test mode</span> : null}
                </span>
                <span className="block text-sm text-muted">UPI, cards, net banking and wallets, through our secure payment provider.</span>
              </span>
            </label>
          ) : null}
          {options.cod ? (
            <label className={cn("flex items-start gap-3 rounded-2xl border p-4", !codAllowed ? "cursor-not-allowed opacity-60" : "cursor-pointer", method === "cod" ? "border-saffron bg-saffron-soft ring-1 ring-saffron" : "border-line bg-paper")}>
              <input type="radio" name="paymentMethod" value="cod" checked={method === "cod"} disabled={!codAllowed} onChange={() => setMethod("cod")} className="mt-1 h-4 w-4 accent-[var(--color-saffron)]" />
              <span>
                <span className="flex items-center gap-2 font-semibold">
                  <Wallet aria-hidden className="h-4 w-4" />
                  Cash on Delivery
                </span>
                <span className="block text-sm text-muted">{codAllowed ? "Pay when your flowers arrive." : `Available for orders up to ${formatINR(options.codMaxOrderPaise ?? 0)}.`}</span>
              </span>
            </label>
          ) : null}
          {errors.paymentMethod ? <p className="field-error">{errors.paymentMethod}</p> : null}
        </fieldset>

        <fieldset className="card space-y-4 p-4 sm:p-5">
          <legend className="sr-only">Notes</legend>
          <Field id="co-notes" label="Notes for your order (optional)" error={errors.notes} hint="For example, a gate number or a preferred colour.">
            <textarea {...inputProps("notes")} rows={2} maxLength={500} className="field-input" />
          </Field>
          {options.whatsappAvailable ? (
            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" checked={whatsapp} onChange={(e) => setWhatsapp(e.target.checked)} className="mt-0.5 h-5 w-5 accent-[var(--color-saffron)]" />
              You may contact me on WhatsApp about this order.
            </label>
          ) : null}
          {/* Spam trap: hidden from people. */}
          <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
            <label htmlFor="co-website">Website</label>
            <input id="co-website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
        </fieldset>
      </div>

      <aside aria-labelledby="co-summary" className="card space-y-4 p-5 lg:sticky lg:top-40">
        <h2 id="co-summary" className="text-xl font-semibold">
          Your order
        </h2>
        {!q ? (
          <div className="skeleton h-40" />
        ) : (
          <>
            <ul className="max-h-64 space-y-2 overflow-y-auto text-sm">
              {q.lines.map((l) => (
                <li key={l.variantId} className="flex justify-between gap-3">
                  <span>
                    <span className="font-medium">{l.name}</span>
                    <span className="block text-muted">
                      {l.quantity} × {formatINR(l.unitPricePaise)} {l.unitText}
                    </span>
                    {l.issue ? <span className="block font-medium text-danger">{l.issue}</span> : null}
                  </span>
                  <span className="shrink-0 font-semibold">{formatINR(l.lineTotalPaise)}</span>
                </li>
              ))}
            </ul>
            <dl className="space-y-2 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <dt>Items</dt>
                <dd>{formatINR(q.itemsSubtotalPaise)}</dd>
              </div>
              {q.discountPaise ? (
                <div className="flex justify-between text-leaf">
                  <dt>Discount{q.coupon ? ` (${q.coupon.code})` : ""}</dt>
                  <dd>-{formatINR(q.discountPaise)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt>Delivery</dt>
                <dd>{q.delivery?.serviceable ? (q.deliveryFeePaise ? formatINR(q.deliveryFeePaise) : "Free") : "Enter PIN code"}</dd>
              </div>
              <div className="flex justify-between border-t border-line pt-3 text-base font-bold">
                <dt>Total to pay</dt>
                <dd>{formatINR(q.totalPaise)}</dd>
              </div>
            </dl>
            {state.coupon && q.couponError ? <p className="text-sm text-danger">Promo code: {q.couponError}</p> : null}
            {q.issues.filter((i) => !i.startsWith("Some items")).map((i) => (
              <p key={i} className="rounded-xl bg-danger-soft p-2.5 text-sm">
                {i}
              </p>
            ))}
          </>
        )}
        {options.checkoutNote ? <p className="text-xs text-muted">{options.checkoutNote}</p> : null}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
          {blocking ? <p className="mb-2 text-center text-sm font-medium text-danger lg:text-left">{blocking}</p> : null}
          <button type="submit" disabled={submitting || !!blocking || !q || quote.status === "loading"} className="btn btn-primary w-full text-base">
            {submitting ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : <Lock aria-hidden className="h-4 w-4" />}
            {submitting ? "Placing your order…" : method === "online" ? `Pay ${q ? formatINR(q.totalPaise) : ""}` : `Place order${q ? ` · ${formatINR(q.totalPaise)}` : ""}`}
          </button>
        </div>
        {options.termsHref ? (
          <p className="text-center text-xs text-muted">
            By placing this order you agree to our{" "}
            <Link href={options.termsHref} className="underline">
              terms
            </Link>
            .
          </p>
        ) : null}
      </aside>
    </form>
  );
}

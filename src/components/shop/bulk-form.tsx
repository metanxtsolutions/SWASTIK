"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";

const UNITS = ["kg", "pieces", "bunches", "bundles", "garlands", "strings", "packs", "baskets"] as const;
const FREQUENCIES = [
  { value: "one_time", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "festival_season", label: "For a festival or season" },
  { value: "other", label: "Other" },
];

type Item = { key: number; flower: string; quantity: string; unit: (typeof UNITS)[number]; notes: string };

let nextKey = 1;
const newItem = (): Item => ({ key: nextKey++, flower: "", quantity: "", unit: "kg", notes: "" });

export function BulkEnquiryForm({ suggestions, minDate }: { suggestions: string[]; minDate: string }) {
  const [items, setItems] = useState<Item[]>([newItem()]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [frequency, setFrequency] = useState("one_time");
  const [startedAt, setStartedAt] = useState(0);
  useEffect(() => setStartedAt(Date.now()), []);

  const update = (key: number, patch: Partial<Item>) => setItems((all) => all.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    const fd = new FormData(e.currentTarget);
    const payload = {
      institutionName: String(fd.get("institutionName") ?? ""),
      contactName: String(fd.get("contactName") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      address: String(fd.get("address") ?? ""),
      pincode: String(fd.get("pincode") ?? ""),
      deliveryDate: String(fd.get("deliveryDate") ?? ""),
      preferredTime: String(fd.get("preferredTime") ?? ""),
      frequency,
      recurringDetails: String(fd.get("recurringDetails") ?? ""),
      instructions: String(fd.get("instructions") ?? ""),
      items: items.filter((i) => i.flower.trim() || i.quantity.trim()).map((i) => ({ flower: i.flower, quantity: i.quantity, unit: i.unit, notes: i.notes })),
      website: String(fd.get("website") ?? ""),
      startedAt,
    };
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch("/api/bulk-enquiry", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.reference) {
        setErrors(body?.fieldErrors ?? {});
        setFormError(body?.error ?? "We could not send your enquiry. Please try again.");
        return;
      }
      setDone(body.reference);
      window.scrollTo({ top: (document.getElementById("enquiry")?.offsetTop ?? 0) - 120, behavior: "smooth" });
    } catch {
      setFormError("You seem to be offline. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-2xl bg-leaf-soft p-6">
        <CheckCircle2 aria-hidden className="h-8 w-8 text-leaf" />
        <h3 className="mt-2 text-2xl font-semibold">Enquiry received</h3>
        <p className="mt-1 text-ink-soft">
          Your reference is <span className="font-mono font-bold text-ink">{done}</span>. We will review availability and pricing and contact you on the number you gave us. This is not yet a confirmed order.
        </p>
      </div>
    );
  }

  const err = (k: string) => (errors[k] ? <p className="field-error">{errors[k]}</p> : null);
  const itemErr = (i: number, k: string) => errors[`items.${i}.${k}`];

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      {formError ? (
        <p role="alert" className="flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm font-medium">
          <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
          {formError}
        </p>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="mb-2 text-lg font-semibold">Who the flowers are for</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="b-inst" className="field-label">
              Mandir, institution or customer name
            </label>
            <input id="b-inst" name="institutionName" className="field-input" required aria-invalid={!!errors.institutionName} />
            {err("institutionName")}
          </div>
          <div>
            <label htmlFor="b-contact" className="field-label">
              Contact person
            </label>
            <input id="b-contact" name="contactName" className="field-input" autoComplete="name" required aria-invalid={!!errors.contactName} />
            {err("contactName")}
          </div>
          <div>
            <label htmlFor="b-phone" className="field-label">
              Mobile number
            </label>
            <input id="b-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" className="field-input" required aria-invalid={!!errors.phone} />
            {err("phone")}
          </div>
          <div>
            <label htmlFor="b-email" className="field-label">
              Email (optional)
            </label>
            <input id="b-email" name="email" type="email" autoComplete="email" className="field-input" aria-invalid={!!errors.email} />
            {err("email")}
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <div>
            <label htmlFor="b-address" className="field-label">
              Delivery address
            </label>
            <textarea id="b-address" name="address" rows={2} className="field-input" autoComplete="street-address" required aria-invalid={!!errors.address} />
            {err("address")}
          </div>
          <div>
            <label htmlFor="b-pin" className="field-label">
              PIN code
            </label>
            <input id="b-pin" name="pincode" inputMode="numeric" maxLength={6} autoComplete="postal-code" className="field-input" required aria-invalid={!!errors.pincode} />
            {err("pincode")}
          </div>
        </div>
      </fieldset>

      <fieldset>
        <legend className="mb-1 text-lg font-semibold">Flowers you need</legend>
        <p className="mb-3 text-sm text-muted">Add one row for each variety. Use the unit you normally buy in.</p>
        {errors.items ? <p className="field-error mb-2">{errors.items}</p> : null}
        <datalist id="flower-suggestions">
          {suggestions.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
        <ul className="space-y-3">
          {items.map((it, idx) => (
            <li key={it.key} className="rounded-2xl border border-line bg-cream/60 p-3 sm:p-4">
              <div className="grid gap-3 sm:grid-cols-[1.6fr_0.8fr_0.9fr_auto] sm:items-end">
                <div>
                  <label htmlFor={`b-f-${it.key}`} className="field-label">
                    Flower variety {items.length > 1 ? idx + 1 : ""}
                  </label>
                  <input id={`b-f-${it.key}`} list="flower-suggestions" value={it.flower} onChange={(e) => update(it.key, { flower: e.target.value })} placeholder="e.g. Marigold (orange)" className="field-input" aria-invalid={!!itemErr(idx, "flower")} />
                  {itemErr(idx, "flower") ? <p className="field-error">{itemErr(idx, "flower")}</p> : null}
                </div>
                <div>
                  <label htmlFor={`b-q-${it.key}`} className="field-label">
                    Quantity
                  </label>
                  <input id={`b-q-${it.key}`} inputMode="decimal" value={it.quantity} onChange={(e) => update(it.key, { quantity: e.target.value.replace(/[^\d.]/g, "") })} className="field-input" aria-invalid={!!itemErr(idx, "quantity")} />
                  {itemErr(idx, "quantity") ? <p className="field-error">{itemErr(idx, "quantity")}</p> : null}
                </div>
                <div>
                  <label htmlFor={`b-u-${it.key}`} className="field-label">
                    Unit
                  </label>
                  <select id={`b-u-${it.key}`} value={it.unit} onChange={(e) => update(it.key, { unit: e.target.value as Item["unit"] })} className="field-input">
                    {UNITS.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={() => setItems((all) => (all.length > 1 ? all.filter((x) => x.key !== it.key) : all))} disabled={items.length === 1} className="btn btn-ghost h-11 text-muted disabled:invisible" aria-label={`Remove flower variety ${idx + 1}`}>
                  <Trash2 aria-hidden className="h-4 w-4" />
                </button>
              </div>
              <label htmlFor={`b-n-${it.key}`} className="sr-only">
                Notes for this variety
              </label>
              <input id={`b-n-${it.key}`} value={it.notes} onChange={(e) => update(it.key, { notes: e.target.value })} placeholder="Notes (optional): colour, garland length, loose or strung" className="field-input mt-3 text-sm" />
            </li>
          ))}
        </ul>
        <button type="button" onClick={() => setItems((all) => (all.length < 30 ? [...all, newItem()] : all))} className="btn btn-secondary mt-3">
          <Plus aria-hidden className="h-4 w-4" />
          Add another variety
        </button>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="mb-2 text-lg font-semibold">When you need them</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="b-date" className="field-label">
              Required delivery date
            </label>
            <input id="b-date" name="deliveryDate" type="date" min={minDate} className="field-input" required aria-invalid={!!errors.deliveryDate} />
            {err("deliveryDate")}
          </div>
          <div>
            <label htmlFor="b-time" className="field-label">
              Preferred time (optional)
            </label>
            <input id="b-time" name="preferredTime" placeholder="e.g. before 6 am" className="field-input" />
          </div>
        </div>
        <div>
          <span className="field-label" id="b-freq-label">
            Is this a one-time or regular requirement?
          </span>
          <div role="radiogroup" aria-labelledby="b-freq-label" className="flex flex-wrap gap-2">
            {FREQUENCIES.map((f) => (
              <label key={f.value} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 text-sm ${frequency === f.value ? "border-saffron bg-saffron-soft font-semibold" : "border-line bg-paper"}`}>
                <input type="radio" name="frequency" value={f.value} checked={frequency === f.value} onChange={() => setFrequency(f.value)} className="sr-only" />
                {f.label}
              </label>
            ))}
          </div>
        </div>
        {frequency !== "one_time" ? (
          <div>
            <label htmlFor="b-rec" className="field-label">
              Tell us about the schedule
            </label>
            <input id="b-rec" name="recurringDetails" placeholder="e.g. every Monday and Friday, from 1 November" className="field-input" />
          </div>
        ) : null}
        <div>
          <label htmlFor="b-ins" className="field-label">
            Anything else we should know? (optional)
          </label>
          <textarea id="b-ins" name="instructions" rows={3} maxLength={1000} className="field-input" />
        </div>
      </fieldset>

      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label htmlFor="b-website">Website</label>
        <input id="b-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button type="submit" className="btn btn-primary px-8 text-base" disabled={submitting}>
          {submitting ? <Loader2 aria-hidden className="h-5 w-5 animate-spin" /> : null}
          {submitting ? "Sending…" : "Request a bulk quote"}
        </button>
        <p className="text-sm text-muted">We will contact you to confirm availability and pricing. Nothing is charged now.</p>
      </div>
    </form>
  );
}

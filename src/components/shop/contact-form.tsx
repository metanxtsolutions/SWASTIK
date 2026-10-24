"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

export function ContactForm({ initialOrder }: { initialOrder: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  useEffect(() => setStartedAt(Date.now()), []);
  if (sent) {
    return (
      <div role="status" className="rounded-2xl bg-leaf-soft p-5">
        <CheckCircle2 aria-hidden className="h-7 w-7 text-leaf" />
        <p className="mt-2 font-semibold">Thank you. Your message has been sent.</p>
        <p className="text-sm text-ink-soft">We will get back to you on the number you gave us.</p>
      </div>
    );
  }
  return (
    <form
      noValidate
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setBusy(true);
        setFormError(null);
        try {
          const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...Object.fromEntries(fd), startedAt }) });
          const body = await res.json().catch(() => null);
          if (!res.ok) {
            setErrors(body?.fieldErrors ?? {});
            setFormError(body?.error ?? "We could not send your message.");
          } else setSent(true);
        } catch {
          setFormError("You seem to be offline. Check your connection and try again.");
        } finally {
          setBusy(false);
        }
      }}
    >
      {formError ? (
        <p role="alert" className="flex items-center gap-2 rounded-xl bg-danger-soft p-3 text-sm font-medium">
          <AlertCircle aria-hidden className="h-4 w-4 text-danger" />
          {formError}
        </p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="c-name" className="field-label">
            Name
          </label>
          <input id="c-name" name="name" autoComplete="name" className="field-input" aria-invalid={!!errors.name} />
          {errors.name ? <p className="field-error">{errors.name}</p> : null}
        </div>
        <div>
          <label htmlFor="c-phone" className="field-label">
            Mobile number
          </label>
          <input id="c-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel-national" className="field-input" aria-invalid={!!errors.phone} />
          {errors.phone ? <p className="field-error">{errors.phone}</p> : null}
        </div>
        <div>
          <label htmlFor="c-email" className="field-label">
            Email (optional)
          </label>
          <input id="c-email" name="email" type="email" autoComplete="email" className="field-input" aria-invalid={!!errors.email} />
          {errors.email ? <p className="field-error">{errors.email}</p> : null}
        </div>
        <div>
          <label htmlFor="c-order" className="field-label">
            Order number (if any)
          </label>
          <input id="c-order" name="orderNumber" defaultValue={initialOrder} className="field-input uppercase" />
        </div>
      </div>
      <div>
        <label htmlFor="c-message" className="field-label">
          Message
        </label>
        <textarea id="c-message" name="message" rows={4} maxLength={2000} className="field-input" aria-invalid={!!errors.message} />
        {errors.message ? <p className="field-error">{errors.message}</p> : null}
      </div>
      <div aria-hidden className="absolute -left-[9999px] h-0 overflow-hidden">
        <label htmlFor="c-website">Website</label>
        <input id="c-website" name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <button type="submit" className="btn btn-primary" disabled={busy}>
        {busy ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
        Send message
      </button>
    </form>
  );
}

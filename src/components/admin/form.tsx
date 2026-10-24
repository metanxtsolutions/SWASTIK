"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useId, useRef } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { ActionState } from "@/server/admin-action-types";

/**
 * Admin forms submit to server actions. Every action checks the admin session on
 * the server; these components only handle pending and result states.
 */
export function AdminForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  encType,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  children: React.ReactNode | ((state: ActionState) => React.ReactNode);
  className?: string;
  resetOnSuccess?: boolean;
  encType?: "multipart/form-data";
}) {
  const [state, formAction, pending] = useActionState(action, { ok: false });
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form
      ref={ref}
      className={className}
      encType={encType}
      noValidate
      // Submitting through a transition (instead of the form action prop) keeps what was
      // typed when the server returns a validation error; React would otherwise reset the form.
      onSubmit={(e) => {
        e.preventDefault();
        const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
        const data = new FormData(e.currentTarget, submitter);
        startTransition(() => formAction(data));
      }}
    >
      <FormNotice state={state} />
      <PendingContext.Provider value={pending}>
        <FieldErrorsContext.Provider value={state.fieldErrors ?? {}}>{typeof children === "function" ? children(state) : children}</FieldErrorsContext.Provider>
      </PendingContext.Provider>
    </form>
  );
}

const FieldErrorsContext = createContext<Record<string, string>>({});
const PendingContext = createContext(false);

export function FormNotice({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl bg-danger-soft p-3 text-sm font-medium text-ink">
        <AlertCircle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
        {state.error}
      </p>
    );
  if (state.ok && state.message)
    return (
      <p role="status" className="mb-4 flex items-start gap-2 rounded-xl bg-leaf-soft p-3 text-sm font-medium text-ink">
        <CheckCircle2 aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-leaf" />
        {state.message}
      </p>
    );
  return null;
}

export function SubmitButton({ children, variant = "primary", className, name, value, confirm }: { children: React.ReactNode; variant?: "primary" | "secondary" | "danger"; className?: string; name?: string; value?: string; confirm?: string }) {
  const pending = useContext(PendingContext);
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={cn("btn", variant === "primary" ? "btn-primary" : variant === "danger" ? "btn-danger" : "btn-secondary", className)}
    >
      {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

interface FieldProps {
  name: string;
  label: string;
  hint?: React.ReactNode;
  className?: string;
  /** Extra keys whose errors should show under this field (e.g. "variants"). */
  errorKeys?: string[];
}

function useFieldError(name: string, extra: string[] = []) {
  const errors = useContext(FieldErrorsContext);
  return errors[name] ?? extra.map((k) => errors[k]).find(Boolean);
}

/** Several forms can share a page (slots, coupons, FAQs), so ids are unique per field instance. */
function useFieldId(name: string) {
  return `f-${name}-${useId().replace(/:/g, "")}`;
}

export function Field({ id, name, label, hint, className, errorKeys, children }: FieldProps & { id: string; children: React.ReactNode }) {
  const error = useFieldError(name, errorKeys);
  return (
    <div className={className}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      {children}
      {error ? <p className="field-error">{error}</p> : hint ? <p className="field-hint">{hint}</p> : null}
    </div>
  );
}

export function TextInput({ name, label, hint, className, errorKeys, ...rest }: FieldProps & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name">) {
  const error = useFieldError(name, errorKeys);
  const id = useFieldId(name);
  return (
    <Field id={id} name={name} label={label} hint={hint} className={className} errorKeys={errorKeys}>
      <input id={id} name={name} className="field-input" aria-invalid={!!error} {...rest} />
    </Field>
  );
}

export function TextArea({ name, label, hint, className, errorKeys, ...rest }: FieldProps & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name">) {
  const error = useFieldError(name, errorKeys);
  const id = useFieldId(name);
  return (
    <Field id={id} name={name} label={label} hint={hint} className={className} errorKeys={errorKeys}>
      <textarea id={id} name={name} className="field-input" aria-invalid={!!error} rows={4} {...rest} />
    </Field>
  );
}

export function Select({ name, label, hint, className, options, errorKeys, ...rest }: FieldProps & { options: { value: string; label: string }[] } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name">) {
  const error = useFieldError(name, errorKeys);
  const id = useFieldId(name);
  return (
    <Field id={id} name={name} label={label} hint={hint} className={className} errorKeys={errorKeys}>
      <select id={id} name={name} className="field-input" aria-invalid={!!error} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Checkbox({ name, label, hint, defaultChecked, value = "on" }: { name: string; label: React.ReactNode; hint?: string; defaultChecked?: boolean; value?: string }) {
  return (
    <label className="flex items-start gap-2.5 text-sm">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-saffron)]" />
      <span>
        <span className="font-medium text-ink">{label}</span>
        {hint ? <span className="block text-muted">{hint}</span> : null}
      </span>
    </label>
  );
}

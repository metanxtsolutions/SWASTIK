import Link from "next/link";
import { cn } from "@/lib/cn";

export function PageHeader({ title, description, actions, back }: { title: string; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6">
      {back ? (
        <Link href={back.href} className="mb-2 inline-block text-sm font-medium text-saffron-dark hover:underline">
          ← {back.label}
        </Link>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold sm:text-3xl">{title}</h1>
          {description ? <div className="mt-1 max-w-3xl text-sm text-ink-soft">{description}</div> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </div>
  );
}

export function Panel({ title, children, className, actions, description }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode; description?: React.ReactNode }) {
  return (
    <section className={cn("card p-4 sm:p-5", className)}>
      {title ? (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="font-sans text-base font-semibold">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
          </div>
          {actions}
        </div>
      ) : null}
      {children}
    </section>
  );
}

export function Badge({ tone = "neutral", children }: { tone?: "neutral" | "good" | "warn" | "bad" | "info"; children: React.ReactNode }) {
  const tones = { neutral: "bg-sand text-ink-soft", good: "bg-leaf-soft text-leaf", warn: "bg-marigold-soft text-saffron-dark", bad: "bg-danger-soft text-danger", info: "bg-info-soft text-info" };
  return <span className={cn("chip whitespace-nowrap", tones[tone])}>{children}</span>;
}

export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border border-line bg-paper", className)}>
      <table className="w-full min-w-[40rem] text-left text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-2.5 [&_th]:font-semibold [&_thead]:bg-sand [&_thead]:text-ink-soft [&_tbody_tr]:border-t [&_tbody_tr]:border-line">{children}</table>
    </div>
  );
}

export function Stat({ label, value, href, tone }: { label: string; value: React.ReactNode; href?: string; tone?: "warn" }) {
  const body = (
    <>
      <p className="text-sm text-muted">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold", tone === "warn" ? "text-saffron-dark" : "text-ink")}>{value}</p>
    </>
  );
  return href ? (
    <Link href={href} className="card block p-4 hover:border-saffron">
      {body}
    </Link>
  ) : (
    <div className="card p-4">{body}</div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line bg-paper p-6 text-center text-sm text-muted">{children}</p>;
}

export const ORDER_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = {
  pending_payment: "neutral",
  pending_confirmation: "warn",
  confirmed: "info",
  preparing: "info",
  ready_for_dispatch: "info",
  out_for_delivery: "info",
  delivered: "good",
  cancelled: "bad",
};

export const PAYMENT_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = {
  unpaid: "neutral",
  pending: "neutral",
  paid: "good",
  failed: "bad",
  refund_pending: "warn",
  partially_refunded: "warn",
  refunded: "neutral",
};

export const ENQUIRY_TONE: Record<string, "neutral" | "good" | "warn" | "bad" | "info"> = { new: "warn", contacted: "info", quoted: "info", accepted: "good", converted: "good", declined: "neutral", closed: "neutral" };

import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { coupons } from "@/server/db/schema";
import { formatDateTime } from "@/lib/dates";
import { formatINR, paiseToRupeesInput } from "@/lib/money";
import { BoundForm } from "@/components/admin/bound-form";
import { Checkbox, Select, SubmitButton, TextInput } from "@/components/admin/form";
import { Badge, Empty, PageHeader, Panel } from "@/components/admin/ui";
import { saveCouponAction, toggleCouponAction } from "../../_actions/ops";

export const metadata: Metadata = { title: "Promo codes" };

type Coupon = typeof coupons.$inferSelect;
const local = (d: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16) : "");

function CouponFields({ c }: { c?: Coupon }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput name="code" label="Code" defaultValue={c?.code ?? ""} className="uppercase" hint="Customers type this at checkout." />
        <Select name="type" label="Discount" defaultValue={c?.type ?? "percent"} options={[{ value: "percent", label: "Percentage off items" }, { value: "fixed", label: "Fixed amount off items" }, { value: "free_delivery", label: "Free delivery" }]} />
        <TextInput name="description" label="Description (shown to customers)" defaultValue={c?.description ?? ""} />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <TextInput name="percent" label="Percent (for percentage)" defaultValue={c?.type === "percent" ? String(c.value) : ""} inputMode="numeric" />
        <TextInput name="amount" label="Amount ₹ (for fixed)" defaultValue={c?.type === "fixed" ? paiseToRupeesInput(c.value) : ""} inputMode="decimal" />
        <TextInput name="maxDiscount" label="Max discount ₹ (optional)" defaultValue={paiseToRupeesInput(c?.maxDiscountPaise)} inputMode="decimal" />
        <TextInput name="minOrder" label="Minimum items total ₹" defaultValue={paiseToRupeesInput(c?.minOrderPaise ?? 0)} inputMode="decimal" />
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <TextInput name="startsAt" label="Starts (optional)" type="datetime-local" defaultValue={local(c?.startsAt ?? null)} />
        <TextInput name="endsAt" label="Ends (optional)" type="datetime-local" defaultValue={local(c?.endsAt ?? null)} />
        <TextInput name="usageLimit" label="Total uses (optional)" defaultValue={c?.usageLimit ? String(c.usageLimit) : ""} inputMode="numeric" />
        <TextInput name="perPhoneLimit" label="Uses per customer (optional)" defaultValue={c?.perPhoneLimit ? String(c.perPhoneLimit) : ""} inputMode="numeric" />
      </div>
      <Checkbox name="isActive" label="Active" defaultChecked={c?.isActive ?? true} />
    </div>
  );
}

export default async function CouponsPage() {
  const rows = await getDb().select().from(coupons).orderBy(desc(coupons.createdAt));
  return (
    <>
      <PageHeader title="Promo codes" description="Codes are checked on the server at checkout: dates, limits and minimum order all apply. Only publish offers you intend to honour." />
      <div className="space-y-3">
        {rows.length ? (
          rows.map((c) => (
            <details key={c.id} className="card p-4">
              <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                <span className="font-mono font-bold">{c.code}</span>
                <span className="text-sm text-ink-soft">{c.type === "percent" ? `${c.value}% off` : c.type === "fixed" ? `${formatINR(c.value)} off` : "Free delivery"}</span>
                <span className="text-xs text-muted">
                  Used {c.usedCount}
                  {c.usageLimit ? ` of ${c.usageLimit}` : ""} {c.endsAt ? `· ends ${formatDateTime(c.endsAt)}` : ""}
                </span>
                {c.isActive ? <Badge tone="good">Active</Badge> : <Badge>Off</Badge>}
              </summary>
              <BoundForm action={saveCouponAction} id={c.id} className="mt-4 space-y-3">
                <CouponFields c={c} />
                <SubmitButton variant="secondary">Save</SubmitButton>
              </BoundForm>
              <BoundForm action={toggleCouponAction} id={c.id} className="mt-2">
                <input type="hidden" name="active" value={c.isActive ? "0" : "1"} />
                <SubmitButton variant="secondary" className="btn-sm">
                  {c.isActive ? "Turn off" : "Turn on"}
                </SubmitButton>
              </BoundForm>
            </details>
          ))
        ) : (
          <Empty>No promo codes yet.</Empty>
        )}
      </div>
      <Panel title="Add a promo code" className="mt-6">
        <BoundForm action={saveCouponAction} id="new" className="space-y-3" resetOnSuccess>
          <CouponFields />
          <SubmitButton>Create code</SubmitButton>
        </BoundForm>
      </Panel>
    </>
  );
}

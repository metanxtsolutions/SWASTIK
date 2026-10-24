import type { ActionState } from "@/server/admin-action-types";
import { paiseToRupeesInput } from "@/lib/money";
import { BoundForm } from "./bound-form";
import { Checkbox, SubmitButton, TextArea, TextInput } from "./form";

export interface ZoneValues {
  name: string;
  slug: string;
  isActive: boolean;
  deliveryFeePaise: number;
  minOrderPaise: number;
  freeDeliveryAbovePaise: number | null;
  minLeadDays: number;
  maxAdvanceDays: number;
  sameDayEnabled: boolean;
  sameDayCutoff: string | null;
  instructions: string;
  landingPublished: boolean;
  landingTitle: string;
  landingContent: string;
  sortOrder: number;
  pincodes: string;
}

export function ZoneForm({ id, values, action }: { id: string; values: ZoneValues; action: (id: string, prev: ActionState, fd: FormData) => Promise<ActionState> }) {
  return (
    <BoundForm action={action} id={id} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextInput name="name" label="Area name" defaultValue={values.name} required hint="Shown to customers, e.g. Rishra or Konnagar." />
        <TextInput name="slug" label="URL slug" defaultValue={values.slug} />
      </div>
      <TextArea
        name="pincodes"
        label="PIN codes served"
        defaultValue={values.pincodes}
        rows={4}
        hint="One per line. Add the localities after a comma, e.g. 712248, Rishra. A PIN code can belong to one area only."
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput name="deliveryFee" label="Delivery charge (₹)" defaultValue={paiseToRupeesInput(values.deliveryFeePaise)} inputMode="decimal" />
        <TextInput name="freeDeliveryAbove" label="Free delivery from (₹, optional)" defaultValue={paiseToRupeesInput(values.freeDeliveryAbovePaise)} inputMode="decimal" />
        <TextInput name="minOrder" label="Minimum order (₹)" defaultValue={paiseToRupeesInput(values.minOrderPaise)} inputMode="decimal" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <TextInput name="minLeadDays" label="Earliest delivery (days after ordering)" defaultValue={String(values.minLeadDays)} inputMode="numeric" hint="1 means next day. Use 0 only with same-day delivery." />
        <TextInput name="maxAdvanceDays" label="Book up to (days ahead)" defaultValue={String(values.maxAdvanceDays)} inputMode="numeric" />
        <TextInput name="sortOrder" label="Sort order" defaultValue={String(values.sortOrder)} inputMode="numeric" />
      </div>
      <div className="rounded-2xl border border-line p-4">
        <Checkbox name="sameDayEnabled" label="Offer same-day delivery" defaultChecked={values.sameDayEnabled} hint="Only turn this on if you can reliably deliver the same day. Needs a lead time of 0 days." />
        <TextInput name="sameDayCutoff" label="Same-day orders close at" type="time" defaultValue={values.sameDayCutoff?.slice(0, 5) ?? ""} className="mt-3 max-w-[12rem]" />
      </div>
      <TextArea name="instructions" label="Delivery note for customers (optional)" defaultValue={values.instructions} rows={2} />
      <details className="rounded-2xl border border-line p-4">
        <summary className="cursor-pointer text-sm font-semibold">Area landing page for search engines (optional)</summary>
        <p className="mt-2 text-sm text-muted">Publish a page at /delivery-areas/slug only if you genuinely serve this area and can write useful local information (at least 300 characters): localities, delivery timings, nearby temples you supply, how to order.</p>
        <div className="mt-3 space-y-3">
          <Checkbox name="landingPublished" label="Publish the area page" defaultChecked={values.landingPublished} />
          <TextInput name="landingTitle" label="Page title" defaultValue={values.landingTitle} placeholder={`Puja flower delivery in ${values.name || "this area"}`} />
          <TextArea name="landingContent" label="Page content" defaultValue={values.landingContent} rows={8} hint="Use ## for headings and - for lists." />
        </div>
      </details>
      <Checkbox name="isActive" label="Active: accept orders for these PIN codes" defaultChecked={values.isActive} />
      <SubmitButton>{id === "new" ? "Create delivery area" : "Save delivery area"}</SubmitButton>
    </BoundForm>
  );
}

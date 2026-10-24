"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { ActionState } from "@/server/admin-action-types";
import { SALE_UNITS, UNIT_NAMES, perUnit, type SaleUnit } from "@/lib/units";
import { AdminForm, Checkbox, Select, SubmitButton, TextArea, TextInput } from "./form";

export interface VariantRow {
  key: string;
  id?: string;
  label: string;
  sku: string;
  unit: SaleUnit;
  price: string;
  salePrice: string;
  trackInventory: boolean;
  stockQuantity: string;
  minOrderQty: string;
  maxOrderQty: string;
  isActive: boolean;
}

export interface ProductFormValues {
  name: string;
  slug: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  usageInfo: string;
  careInfo: string;
  unit: SaleUnit;
  tags: string;
  status: "draft" | "published" | "archived";
  isFeatured: boolean;
  isBestseller: boolean;
  sortOrder: string;
  seoTitle: string;
  seoDescription: string;
  collectionIds: string[];
  zoneIds: string[];
  variants: VariantRow[];
}

const unitOptions = SALE_UNITS.map((u) => ({ value: u, label: `per ${UNIT_NAMES[u].singular}` }));

let k = 0;
const key = () => `v${++k}`;

export function newVariant(unit: SaleUnit = "piece"): VariantRow {
  return { key: key(), label: "", sku: "", unit, price: "", salePrice: "", trackInventory: true, stockQuantity: "0", minOrderQty: "1", maxOrderQty: "", isActive: true };
}

export function ProductForm({
  action,
  initial,
  categories,
  collections,
  zones,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  initial: ProductFormValues;
  categories: { id: string; name: string }[];
  collections: { id: string; name: string }[];
  zones: { id: string; name: string }[];
}) {
  const [variants, setVariants] = useState<VariantRow[]>(initial.variants.length ? initial.variants : [newVariant(initial.unit)]);
  const [unit, setUnit] = useState<SaleUnit>(initial.unit);
  const update = (rk: string, patch: Partial<VariantRow>) => setVariants((all) => all.map((v) => (v.key === rk ? { ...v, ...patch } : v)));

  return (
    <AdminForm action={action} className="space-y-5">
      {(state) => (
        <>
          <input type="hidden" name="variants" value={JSON.stringify(variants.map(({ key: _k, ...v }) => v))} />
          <section className="card space-y-4 p-4 sm:p-5">
            <h2 className="font-sans text-base font-semibold">Basics</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextInput name="name" label="Product name" defaultValue={initial.name} required />
              <TextInput name="slug" label="URL slug" defaultValue={initial.slug} hint="Leave empty to create one from the name, e.g. marigold-flowers-loose." />
              <Select name="categoryId" label="Category" defaultValue={initial.categoryId} options={[{ value: "", label: "Choose a category" }, ...categories.map((c) => ({ value: c.id, label: c.name }))]} />
              <Select name="status" label="Status" defaultValue={initial.status} options={[{ value: "draft", label: "Draft (hidden)" }, { value: "published", label: "Published (on sale)" }, { value: "archived", label: "Archived" }]} />
            </div>
            <TextInput name="shortDescription" label="Short description" defaultValue={initial.shortDescription} maxLength={200} hint="One line shown under the name, e.g. what is in the pack." />
            <TextArea name="description" label="Description" defaultValue={initial.description} rows={5} hint="Describe the flowers honestly: variety, colour, size, how they are packed. At least 30 characters to publish." />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextArea name="usageInfo" label="Used for (optional)" defaultValue={initial.usageInfo} rows={3} hint="Occasions and common uses. Avoid claims you cannot stand behind." />
              <TextArea name="careInfo" label="Keeping it fresh (optional)" defaultValue={initial.careInfo} rows={3} />
            </div>
            <TextInput name="tags" label="Search tags" defaultValue={initial.tags} hint="Comma separated, e.g. genda, kali puja, loose flowers. Helps search." />
          </section>

          <section className="card space-y-4 p-4 sm:p-5">
            <div>
              <h2 className="font-sans text-base font-semibold">Price, unit and stock</h2>
              <p className="text-sm text-muted">Each option is one thing a customer can buy, with its own price per unit. Use options for sizes such as 250 g, 500 g and 1 kg.</p>
            </div>
            <div className="max-w-xs">
              <Select name="unit" label="Main unit of sale" value={unit} onChange={(e) => setUnit(e.target.value as SaleUnit)} options={unitOptions} />
            </div>
            {state.fieldErrors?.variants ? <p className="field-error">{state.fieldErrors.variants}</p> : null}
            <ul className="space-y-3">
              {variants.map((v, i) => {
                const err = (f: string) => state.fieldErrors?.[`variants.${i}.${f}`];
                return (
                  <li key={v.key} className="rounded-2xl border border-line bg-cream/50 p-3 sm:p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <p className="text-sm font-semibold">Option {i + 1}</p>
                      <button type="button" onClick={() => setVariants((all) => all.filter((x) => x.key !== v.key))} disabled={variants.length === 1} className="btn btn-ghost btn-sm text-muted disabled:invisible">
                        <Trash2 aria-hidden className="h-4 w-4" />
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                      <label className="text-sm">
                        <span className="field-label">Label {variants.length > 1 ? "" : "(optional)"}</span>
                        <input className="field-input" value={v.label} onChange={(e) => update(v.key, { label: e.target.value })} placeholder="e.g. 250 g, 3 ft, Bunch of 10" />
                      </label>
                      <label className="text-sm">
                        <span className="field-label">Sold</span>
                        <select className="field-input" value={v.unit} onChange={(e) => update(v.key, { unit: e.target.value as SaleUnit })}>
                          {unitOptions.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm">
                        <span className="field-label">Price (₹)</span>
                        <input className="field-input" inputMode="decimal" value={v.price} onChange={(e) => update(v.key, { price: e.target.value })} aria-invalid={!!err("price")} />
                        {err("price") ? <span className="field-error block">{err("price")}</span> : null}
                      </label>
                      <label className="text-sm">
                        <span className="field-label">Sale price (₹, optional)</span>
                        <input className="field-input" inputMode="decimal" value={v.salePrice} onChange={(e) => update(v.key, { salePrice: e.target.value })} aria-invalid={!!err("salePrice")} />
                        {err("salePrice") ? <span className="field-error block">{err("salePrice")}</span> : null}
                      </label>
                      <label className="text-sm">
                        <span className="field-label">SKU</span>
                        <input className="field-input uppercase" value={v.sku} onChange={(e) => update(v.key, { sku: e.target.value.toUpperCase() })} placeholder="e.g. MRG-250" aria-invalid={!!err("sku")} />
                        {err("sku") ? <span className="field-error block">{err("sku")}</span> : null}
                      </label>
                      <label className="text-sm">
                        <span className="field-label">Stock</span>
                        <input className="field-input" inputMode="numeric" value={v.stockQuantity} disabled={!v.trackInventory} onChange={(e) => update(v.key, { stockQuantity: e.target.value.replace(/\D/g, "") })} />
                      </label>
                      <label className="text-sm">
                        <span className="field-label">Minimum per order</span>
                        <input className="field-input" inputMode="numeric" value={v.minOrderQty} onChange={(e) => update(v.key, { minOrderQty: e.target.value.replace(/\D/g, "") })} />
                      </label>
                      <label className="text-sm">
                        <span className="field-label">Maximum per order (optional)</span>
                        <input className="field-input" inputMode="numeric" value={v.maxOrderQty} onChange={(e) => update(v.key, { maxOrderQty: e.target.value.replace(/\D/g, "") })} aria-invalid={!!err("maxOrderQty")} />
                        {err("maxOrderQty") ? <span className="field-error block">{err("maxOrderQty")}</span> : null}
                      </label>
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={v.trackInventory} onChange={(e) => update(v.key, { trackInventory: e.target.checked })} className="h-4 w-4 accent-[var(--color-saffron)]" />
                        Track stock (untick for made-to-order items)
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={v.isActive} onChange={(e) => update(v.key, { isActive: e.target.checked })} className="h-4 w-4 accent-[var(--color-saffron)]" />
                        Available to buy
                      </label>
                      {v.price ? (
                        <span className="text-muted">
                          Customers see: ₹{v.salePrice || v.price} {perUnit(v.unit, v.label)}
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setVariants((all) => [...all, newVariant(unit)])} disabled={variants.length >= 20}>
              <Plus aria-hidden className="h-4 w-4" />
              Add option
            </button>
          </section>

          <section className="card space-y-4 p-4 sm:p-5">
            <h2 className="font-sans text-base font-semibold">Where it appears</h2>
            <div className="flex flex-wrap gap-6">
              <Checkbox name="isFeatured" label="Featured (Popular puja flowers on the home page)" defaultChecked={initial.isFeatured} />
              <Checkbox name="isBestseller" label="Mark as bestseller" defaultChecked={initial.isBestseller} hint="Used until enough real sales exist to rank bestsellers." />
            </div>
            <TextInput name="sortOrder" label="Sort order" defaultValue={initial.sortOrder} inputMode="numeric" className="max-w-[10rem]" hint="Lower numbers show first." />
            {collections.length ? (
              <fieldset>
                <legend className="field-label">Festival and occasion collections</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {collections.map((c) => (
                    <Checkbox key={c.id} name="collectionIds" value={c.id} label={c.name} defaultChecked={initial.collectionIds.includes(c.id)} />
                  ))}
                </div>
              </fieldset>
            ) : null}
            {zones.length ? (
              <fieldset>
                <legend className="field-label">Sell only in these delivery areas (leave all unticked to sell everywhere)</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {zones.map((z) => (
                    <Checkbox key={z.id} name="zoneIds" value={z.id} label={z.name} defaultChecked={initial.zoneIds.includes(z.id)} />
                  ))}
                </div>
              </fieldset>
            ) : null}
          </section>

          <section className="card space-y-4 p-4 sm:p-5">
            <h2 className="font-sans text-base font-semibold">Search engines</h2>
            <TextInput name="seoTitle" label="SEO title (optional)" defaultValue={initial.seoTitle} maxLength={70} hint="Defaults to the product name. Under 60 characters works best." />
            <TextArea name="seoDescription" label="SEO description (optional)" defaultValue={initial.seoDescription} maxLength={170} rows={2} hint="Defaults to the short description and price." />
          </section>

          <div className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-[#f7f3ee]/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border">
            <SubmitButton>Save product</SubmitButton>
          </div>
        </>
      )}
    </AdminForm>
  );
}

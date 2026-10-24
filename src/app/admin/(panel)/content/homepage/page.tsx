import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { getSettings } from "@/server/services/settings";
import { listAdminProducts } from "@/server/services/admin-catalog";
import { catalogOptions } from "@/server/admin-data";
import { AdminForm, Checkbox, Select, SubmitButton, TextArea, TextInput } from "@/components/admin/form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { saveHomepageAction } from "../../../_actions/content";

export const metadata: Metadata = { title: "Home page" };

const SECTION_LABELS: Record<string, string> = {
  categories: "Shop by flower (categories)",
  popular: "Popular puja flowers",
  daily: "Daily puja essentials",
  garlands: "Garlands and bundles",
  collections: "Festival and occasion collections",
  bestsellers: "Bestsellers",
  offers: "Current offers (offer banners)",
  why: "Why order from us",
  delivery: "Delivery areas",
  bulk: "Bulk orders for mandirs",
  reviews: "Customer reviews (only published genuine reviews)",
  guides: "Flower guides",
  faq: "Questions and answers",
};

export default async function HomepageSettingsPage() {
  const db = getDb();
  const [h, opts, products] = await Promise.all([getSettings(db, "homepage"), catalogOptions(db), listAdminProducts(db, { status: "published" })]);
  const why = [...h.whyItems, ...Array.from({ length: Math.max(0, 6 - h.whyItems.length) }, () => ({ title: "", body: "" }))];
  return (
    <>
      <PageHeader back={{ href: "/admin/content", label: "Website content" }} title="Home page" description="Sections without content are hidden automatically, so the page never shows empty blocks." />
      <AdminForm action={saveHomepageAction} className="space-y-5">
        <Panel title="Announcement bar" description="A short line above the header, for a real current message such as a delivery update or an offer you are running.">
          <div className="space-y-3">
            <Checkbox name="announcementEnabled" label="Show the announcement" defaultChecked={h.announcementEnabled} />
            <TextInput name="announcementText" label="Text" defaultValue={h.announcementText} maxLength={160} />
            <TextInput name="announcementHref" label="Link (optional)" defaultValue={h.announcementHref} placeholder="/collections/durga-puja-flowers" />
          </div>
        </Panel>
        <Panel title="Hero" description="Shown when no hero banner is active. Add a hero banner with a photo under Banners to replace the illustration.">
          <div className="space-y-3">
            <TextInput name="heroEyebrow" label="Small line above the heading" defaultValue={h.heroEyebrow} />
            <TextInput name="heroTitle" label="Heading" defaultValue={h.heroTitle} maxLength={120} />
            <TextArea name="heroSubtitle" label="Text" defaultValue={h.heroSubtitle} rows={3} maxLength={300} />
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput name="heroCtaLabel" label="Button text" defaultValue={h.heroCtaLabel} />
              <TextInput name="heroCtaHref" label="Button link" defaultValue={h.heroCtaHref} />
            </div>
          </div>
        </Panel>
        <Panel title="Sections">
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.entries(h.sections).map(([k, v]) => (
              <Checkbox key={k} name={`section_${k}`} label={SECTION_LABELS[k] ?? k} defaultChecked={v} />
            ))}
          </div>
        </Panel>
        <Panel title="What appears in each section">
          <div className="space-y-5">
            <fieldset>
              <legend className="field-label">Categories to feature (none ticked shows all categories that have products)</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {opts.categories.map((c) => (
                  <Checkbox key={c.id} name="featuredCategoryIds" value={c.id} label={c.name} defaultChecked={h.featuredCategoryIds.includes(c.id)} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="field-label">Popular puja flowers (none ticked shows products marked Featured)</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {products.rows.map(({ p }) => (
                  <Checkbox key={p.id} name="popularProductIds" value={p.id} label={p.name} defaultChecked={h.popularProductIds.includes(p.id)} />
                ))}
              </div>
            </fieldset>
            <Select name="dailyCategoryId" label="Category for Daily puja essentials" defaultValue={h.dailyCategoryId ?? ""} options={[{ value: "", label: "Daily Puja Flower Packs (default)" }, ...opts.categories.map((c) => ({ value: c.id, label: c.name }))]} className="max-w-md" />
            <fieldset>
              <legend className="field-label">Categories for Garlands and bundles (none ticked uses Flower Garlands and Mixed Flower Bundles)</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-2">
                {opts.categories.map((c) => (
                  <Checkbox key={c.id} name="garlandCategoryIds" value={c.id} label={c.name} defaultChecked={h.garlandCategoryIds.includes(c.id)} />
                ))}
              </div>
            </fieldset>
          </div>
        </Panel>
        <Panel title="Why order from us" description="Up to six short points. Only include claims that are true for your business.">
          <TextInput name="whyTitle" label="Section heading" defaultValue={h.whyTitle} className="mb-4" />
          <div className="grid gap-4 sm:grid-cols-2">
            {why.map((w, i) => (
              <div key={i} className="space-y-2 rounded-2xl border border-line p-3">
                <TextInput name={`why_${i}_title`} label={`Point ${i + 1} title`} defaultValue={w.title} />
                <TextArea name={`why_${i}_body`} label="Text" defaultValue={w.body} rows={2} />
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Bulk orders block">
          <div className="space-y-3">
            <TextInput name="bulkTitle" label="Heading" defaultValue={h.bulkTitle} />
            <TextArea name="bulkBody" label="Text" defaultValue={h.bulkBody} rows={3} />
          </div>
        </Panel>
        <SubmitButton>Save home page</SubmitButton>
      </AdminForm>
    </>
  );
}

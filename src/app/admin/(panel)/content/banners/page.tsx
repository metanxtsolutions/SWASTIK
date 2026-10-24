import type { Metadata } from "next";
import Image from "next/image";
import { asc } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { banners } from "@/server/db/schema";
import { BoundForm } from "@/components/admin/bound-form";
import { Checkbox, Select, SubmitButton, TextInput } from "@/components/admin/form";
import { Badge, Empty, PageHeader, Panel } from "@/components/admin/ui";
import { deleteBannerAction, saveBannerAction } from "../../../_actions/content";

export const metadata: Metadata = { title: "Banners" };
type Banner = typeof banners.$inferSelect;
const local = (d: Date | null) => (d ? new Date(d.getTime() + 330 * 60_000).toISOString().slice(0, 16) : "");

function BannerFields({ b }: { b?: Banner }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <Select name="placement" label="Where" defaultValue={b?.placement ?? "hero"} options={[{ value: "hero", label: "Home page hero" }, { value: "offer", label: "Current offers" }]} />
        <TextInput name="eyebrow" label="Small line (optional)" defaultValue={b?.eyebrow ?? ""} />
        <TextInput name="sortOrder" label="Sort order" defaultValue={String(b?.sortOrder ?? 0)} inputMode="numeric" />
      </div>
      <TextInput name="title" label="Heading" defaultValue={b?.title ?? ""} />
      <TextInput name="subtitle" label="Text (optional)" defaultValue={b?.subtitle ?? ""} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput name="ctaLabel" label="Button text (optional)" defaultValue={b?.ctaLabel ?? ""} />
        <TextInput name="ctaHref" label="Button link" defaultValue={b?.ctaHref ?? ""} placeholder="/shop or /collections/durga-puja-flowers" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="field-label">Photo (JPEG, PNG or WebP, landscape, at least 1200 px wide recommended)</span>
          <input type="file" name="image" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-saffron-soft file:px-4 file:py-2 file:font-semibold file:text-saffron-dark" />
        </label>
        <TextInput name="imageAlt" label="Describe the photo" defaultValue={b?.imageAlt ?? ""} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextInput name="startsAt" label="Show from (optional)" type="datetime-local" defaultValue={local(b?.startsAt ?? null)} />
        <TextInput name="endsAt" label="Show until (optional)" type="datetime-local" defaultValue={local(b?.endsAt ?? null)} />
      </div>
      <Checkbox name="isActive" label="Active" defaultChecked={b?.isActive ?? true} />
    </div>
  );
}

export default async function BannersPage() {
  const rows = await getDb().select().from(banners).orderBy(asc(banners.placement), asc(banners.sortOrder));
  return (
    <>
      <PageHeader back={{ href: "/admin/content", label: "Website content" }} title="Banners and offers" description="The first active hero banner replaces the home page hero. Offer cards appear in Current offers. Publish only offers you are actually running." />
      <div className="space-y-3">
        {rows.length ? (
          rows.map((b) => (
            <details key={b.id} className="card p-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                {b.imageId ? (
                  <span className="relative h-12 w-20 overflow-hidden rounded-lg bg-sand">
                    <Image src={`/api/media/${b.imageId}/banner`} alt="" fill sizes="80px" className="object-cover" />
                  </span>
                ) : null}
                <span className="font-semibold">{b.title}</span>
                <Badge tone="info">{b.placement === "hero" ? "Hero" : "Offer"}</Badge>
                {b.isActive ? <Badge tone="good">Active</Badge> : <Badge>Off</Badge>}
              </summary>
              <BoundForm action={saveBannerAction} id={b.id} className="mt-4 space-y-3" encType="multipart/form-data">
                <BannerFields b={b} />
                <SubmitButton variant="secondary">Save</SubmitButton>
              </BoundForm>
              <BoundForm action={deleteBannerAction} id={b.id} className="mt-2">
                <SubmitButton variant="secondary" className="btn-sm" confirm="Delete this banner?">
                  Delete
                </SubmitButton>
              </BoundForm>
            </details>
          ))
        ) : (
          <Empty>No banners yet. The home page shows its built-in hero.</Empty>
        )}
      </div>
      <Panel title="Add a banner" className="mt-6">
        <BoundForm action={saveBannerAction} id="new" className="space-y-3" encType="multipart/form-data" resetOnSuccess>
          <BannerFields />
          <SubmitButton>Add banner</SubmitButton>
        </BoundForm>
      </Panel>
    </>
  );
}

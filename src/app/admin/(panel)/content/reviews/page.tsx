import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { testimonials } from "@/server/db/schema";
import { BoundForm } from "@/components/admin/bound-form";
import { Checkbox, SubmitButton, TextArea, TextInput } from "@/components/admin/form";
import { Badge, Empty, PageHeader, Panel } from "@/components/admin/ui";
import { deleteTestimonialAction, saveTestimonialAction } from "../../../_actions/content";

export const metadata: Metadata = { title: "Customer reviews" };

export default async function ReviewsPage() {
  const rows = await getDb().select().from(testimonials).orderBy(asc(testimonials.sortOrder));
  const fields = (t?: (typeof rows)[number]) => (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <TextInput name="customerName" label="Customer name (as they agreed to be shown)" defaultValue={t?.customerName ?? ""} />
        <TextInput name="locality" label="Locality (optional)" defaultValue={t?.locality ?? ""} />
        <TextInput name="receivedOn" label="Received on" type="date" defaultValue={t?.receivedOn ?? ""} />
      </div>
      <TextArea name="body" label="Review, in the customer's words" defaultValue={t?.body ?? ""} rows={3} />
      <TextInput name="sortOrder" label="Sort order" defaultValue={String(t?.sortOrder ?? 0)} inputMode="numeric" className="max-w-[10rem]" />
      <Checkbox name="consentConfirmed" label="This is a genuine review and the customer agreed to it being shown" />
      <Checkbox name="isPublished" label="Published" defaultChecked={t?.isPublished ?? false} />
    </div>
  );
  return (
    <>
      <PageHeader back={{ href: "/admin/content", label: "Website content" }} title="Customer reviews" description="Add only real reviews from real customers, with their permission. The reviews section stays hidden until at least one is published." />
      <div className="space-y-3">
        {rows.length ? (
          rows.map((t) => (
            <details key={t.id} className="card p-4">
              <summary className="cursor-pointer">
                <span className="font-semibold">{t.customerName}</span> {t.isPublished ? <Badge tone="good">Published</Badge> : <Badge>Hidden</Badge>}
                <span className="block truncate text-sm text-muted">{t.body}</span>
              </summary>
              <BoundForm action={saveTestimonialAction} id={t.id} className="mt-4 space-y-3">
                {fields(t)}
                <SubmitButton variant="secondary">Save</SubmitButton>
              </BoundForm>
              <BoundForm action={deleteTestimonialAction} id={t.id} className="mt-2">
                <SubmitButton variant="secondary" className="btn-sm" confirm="Delete this review?">
                  Delete
                </SubmitButton>
              </BoundForm>
            </details>
          ))
        ) : (
          <Empty>No reviews yet.</Empty>
        )}
      </div>
      <Panel title="Add a review" className="mt-6">
        <BoundForm action={saveTestimonialAction} id="new" className="space-y-3" resetOnSuccess>
          {fields()}
          <SubmitButton>Add review</SubmitButton>
        </BoundForm>
      </Panel>
    </>
  );
}

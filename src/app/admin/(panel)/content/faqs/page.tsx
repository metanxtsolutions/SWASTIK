import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { faqs } from "@/server/db/schema";
import { catalogOptions } from "@/server/admin-data";
import { BoundForm } from "@/components/admin/bound-form";
import { Checkbox, Select, SubmitButton, TextArea, TextInput } from "@/components/admin/form";
import { Badge, PageHeader, Panel } from "@/components/admin/ui";
import { deleteFaqAction, saveFaqAction } from "../../../_actions/content";

export const metadata: Metadata = { title: "Questions and answers" };

const TOPICS = [
  { value: "ordering", label: "Ordering" },
  { value: "delivery", label: "Delivery" },
  { value: "payment", label: "Payment" },
  { value: "bulk", label: "Bulk orders" },
  { value: "product", label: "Flowers and products" },
  { value: "general", label: "Other" },
];

export default async function FaqsPage() {
  const db = getDb();
  const [rows, opts] = await Promise.all([db.select().from(faqs).orderBy(asc(faqs.topic), asc(faqs.sortOrder)), catalogOptions(db)]);
  const catOptions = [{ value: "", label: "General (not tied to a category)" }, ...opts.categories.map((c) => ({ value: c.id, label: `Category: ${c.name}` }))];
  const fields = (f?: (typeof rows)[number]) => (
    <div className="space-y-3">
      <TextInput name="question" label="Question" defaultValue={f?.question ?? ""} />
      <TextArea name="answer" label="Answer" defaultValue={f?.answer ?? ""} rows={3} hint="Keep answers factual and specific to how your business works." />
      <div className="grid gap-3 sm:grid-cols-3">
        <Select name="topic" label="Topic" defaultValue={f?.topic ?? "ordering"} options={TOPICS} />
        <Select name="categoryId" label="Show on" defaultValue={f?.categoryId ?? ""} options={catOptions} />
        <TextInput name="sortOrder" label="Sort order" defaultValue={String(f?.sortOrder ?? 0)} inputMode="numeric" />
      </div>
      <Checkbox name="isPublished" label="Published" defaultChecked={f?.isPublished ?? true} />
    </div>
  );
  return (
    <>
      <PageHeader back={{ href: "/admin/content", label: "Website content" }} title="Questions and answers" description="General questions appear on the FAQ page and relevant pages. Category questions appear on that category's page and its products." />
      <div className="space-y-3">
        {rows.map((f) => (
          <details key={f.id} className="card p-4">
            <summary className="flex cursor-pointer flex-wrap items-center gap-2">
              <span className="font-semibold">{f.question}</span>
              <Badge tone="info">{TOPICS.find((t) => t.value === f.topic)?.label ?? f.topic}</Badge>
              {!f.isPublished ? <Badge>Hidden</Badge> : null}
            </summary>
            <BoundForm action={saveFaqAction} id={f.id} className="mt-4 space-y-3">
              {fields(f)}
              <SubmitButton variant="secondary">Save</SubmitButton>
            </BoundForm>
            <BoundForm action={deleteFaqAction} id={f.id} className="mt-2">
              <SubmitButton variant="secondary" className="btn-sm" confirm="Delete this question?">
                Delete
              </SubmitButton>
            </BoundForm>
          </details>
        ))}
      </div>
      <Panel title="Add a question" className="mt-6">
        <BoundForm action={saveFaqAction} id="new" className="space-y-3" resetOnSuccess>
          {fields()}
          <SubmitButton>Add question</SubmitButton>
        </BoundForm>
      </Panel>
    </>
  );
}

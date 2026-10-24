import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { articles } from "@/server/db/schema";
import { catalogOptions } from "@/server/admin-data";
import { BoundForm } from "@/components/admin/bound-form";
import { Select, SubmitButton, TextArea, TextInput } from "@/components/admin/form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { deleteArticleAction, saveArticleAction } from "../../../../_actions/content";

export const metadata: Metadata = { title: "Edit guide" };

export default async function EditGuide({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = getDb();
  const a = id === "new" ? null : /^[0-9a-f-]{36}$/.test(id) ? (await db.select().from(articles).where(eq(articles.id, id)))[0] : undefined;
  if (a === undefined) notFound();
  const opts = await catalogOptions(db);
  return (
    <>
      <PageHeader back={{ href: "/admin/content/guides", label: "Guides" }} title={a?.title ?? "New guide"} />
      <Panel>
        <BoundForm action={saveArticleAction} id={a?.id ?? "new"} className="space-y-4" encType="multipart/form-data">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput name="title" label="Title" defaultValue={a?.title ?? ""} />
            <TextInput name="slug" label="Address (optional)" defaultValue={a?.slug ?? ""} hint="Created from the title if empty." />
          </div>
          <TextArea name="excerpt" label="Summary" defaultValue={a?.excerpt ?? ""} rows={2} maxLength={300} />
          <TextArea name="body" label="Content" defaultValue={a?.body ?? ""} rows={20} hint="Use ## for headings, - for lists, **bold**, and [link text](/path). Write from real knowledge; avoid religious rules or claims you cannot support." />
          <div className="grid gap-4 sm:grid-cols-3">
            <TextInput name="authorName" label="Author" defaultValue={a?.authorName ?? "Swastik"} />
            <Select name="relatedCategoryId" label="Related category" defaultValue={a?.relatedCategoryId ?? ""} options={[{ value: "", label: "None" }, ...opts.categories.map((c) => ({ value: c.id, label: c.name }))]} />
            <Select name="status" label="Status" defaultValue={a?.status ?? "draft"} options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "archived", label: "Archived" }]} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="field-label">Cover photo (optional)</span>
              <input type="file" name="cover" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-saffron-soft file:px-4 file:py-2 file:font-semibold file:text-saffron-dark" />
            </label>
            <TextInput name="coverAlt" label="Describe the cover photo" defaultValue={a?.coverAlt ?? ""} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput name="seoTitle" label="SEO title (optional)" defaultValue={a?.seoTitle ?? ""} />
            <TextInput name="seoDescription" label="SEO description (optional)" defaultValue={a?.seoDescription ?? ""} />
          </div>
          <SubmitButton>Save guide</SubmitButton>
        </BoundForm>
      </Panel>
      {a ? (
        <Panel title="Delete guide" className="mt-6">
          <BoundForm action={deleteArticleAction} id={a.id}>
            <SubmitButton variant="danger" className="btn-sm" confirm="Delete this guide?">
              Delete
            </SubmitButton>
          </BoundForm>
        </Panel>
      ) : null}
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { pages } from "@/server/db/schema";
import { BoundForm } from "@/components/admin/bound-form";
import { Checkbox, SubmitButton, TextArea, TextInput } from "@/components/admin/form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { deletePageAction, savePageAction } from "../../../../_actions/content";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = id === "new" ? null : /^[0-9a-f-]{36}$/.test(id) ? (await getDb().select().from(pages).where(eq(pages.id, id)))[0] : undefined;
  if (page === undefined) notFound();
  return (
    <>
      <PageHeader back={{ href: "/admin/content/pages", label: "Pages" }} title={page?.title ?? "New page"} />
      <Panel>
        <BoundForm action={savePageAction} id={page?.id ?? "new"} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput name="title" label="Title" defaultValue={page?.title ?? ""} />
            <TextInput name="slug" label="Address" defaultValue={page?.slug ?? ""} hint="The page appears at /address, e.g. privacy-policy." />
          </div>
          <TextArea name="body" label="Content" defaultValue={page?.body ?? ""} rows={18} hint="Use ## for headings, - for lists, **bold**, and [link text](/path)." />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextInput name="seoTitle" label="SEO title (optional)" defaultValue={page?.seoTitle ?? ""} />
            <TextInput name="seoDescription" label="SEO description (optional)" defaultValue={page?.seoDescription ?? ""} />
          </div>
          <div className="flex flex-wrap gap-6">
            <Checkbox name="isPublished" label="Published" defaultChecked={page?.isPublished ?? false} />
            <Checkbox name="showInFooter" label="Link in the footer" defaultChecked={page?.showInFooter ?? true} />
          </div>
          <SubmitButton>Save page</SubmitButton>
        </BoundForm>
      </Panel>
      {page ? (
        <Panel title="Delete page" className="mt-6">
          <BoundForm action={deletePageAction} id={page.id}>
            <SubmitButton variant="danger" className="btn-sm" confirm="Delete this page?">
              Delete
            </SubmitButton>
          </BoundForm>
        </Panel>
      ) : null}
    </>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { categories } from "@/server/db/schema";
import { BoundForm } from "@/components/admin/bound-form";
import { GroupingForm } from "@/components/admin/grouping-form";
import { SubmitButton } from "@/components/admin/form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { deleteCategoryAction, saveCategoryAction } from "../../../_actions/catalog";

export const metadata: Metadata = { title: "Edit category" };

export default async function EditCategoryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [c] = await getDb().select().from(categories).where(eq(categories.id, id));
  if (!c) notFound();
  return (
    <>
      <PageHeader back={{ href: "/admin/categories", label: "Categories" }} title={c.name} />
      <Panel>
        <GroupingForm id={c.id} kind="category" action={saveCategoryAction} values={c} />
      </Panel>
      <Panel title="Delete category" className="mt-6" description="Only empty categories can be deleted. Hide a category to remove it from the shop without deleting it.">
        <BoundForm action={deleteCategoryAction} id={c.id}>
          <SubmitButton variant="danger" className="btn-sm" confirm="Delete this category?">
            Delete category
          </SubmitButton>
        </BoundForm>
      </Panel>
    </>
  );
}

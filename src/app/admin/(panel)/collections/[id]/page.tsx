import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { collections } from "@/server/db/schema";
import { BoundForm } from "@/components/admin/bound-form";
import { GroupingForm } from "@/components/admin/grouping-form";
import { SubmitButton } from "@/components/admin/form";
import { PageHeader, Panel } from "@/components/admin/ui";
import { deleteCollectionAction, saveCollectionAction } from "../../../_actions/catalog";

export const metadata: Metadata = { title: "Edit collection" };

export default async function EditCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const [c] = await getDb().select().from(collections).where(eq(collections.id, id));
  if (!c) notFound();
  return (
    <>
      <PageHeader back={{ href: "/admin/collections", label: "Collections" }} title={c.name} />
      <Panel>
        <GroupingForm id={c.id} kind="collection" action={saveCollectionAction} values={c} />
      </Panel>
      <Panel title="Delete collection" className="mt-6" description="Products stay in the shop; only the grouping is removed.">
        <BoundForm action={deleteCollectionAction} id={c.id}>
          <SubmitButton variant="danger" className="btn-sm" confirm="Delete this collection?">
            Delete collection
          </SubmitButton>
        </BoundForm>
      </Panel>
    </>
  );
}

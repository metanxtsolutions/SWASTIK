import type { Metadata } from "next";
import { asc } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { redirects } from "@/server/db/schema";
import { AdminForm, Checkbox, SubmitButton, TextInput } from "@/components/admin/form";
import { BoundForm } from "@/components/admin/bound-form";
import { Empty, PageHeader, Panel, Table } from "@/components/admin/ui";
import { deleteRedirectAction, saveRedirectAction } from "../../../_actions/content";

export const metadata: Metadata = { title: "Redirects" };

export default async function RedirectsPage() {
  const rows = await getDb().select().from(redirects).orderBy(asc(redirects.fromPath));
  return (
    <>
      <PageHeader back={{ href: "/admin/content", label: "Website content" }} title="Redirects" description="When you rename a product or page, add a redirect from the old address so links and search results keep working. Redirects apply to addresses that no longer exist." />
      {rows.length ? (
        <Table>
          <thead>
            <tr>
              <th>From</th>
              <th>To</th>
              <th>Type</th>
              <th>Visits</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{r.fromPath}</td>
                <td className="font-mono text-xs">{r.toPath}</td>
                <td className="text-sm">{r.permanent ? "Permanent (301/308)" : "Temporary"}</td>
                <td className="text-sm">{r.hits}</td>
                <td>
                  <BoundForm action={deleteRedirectAction} id={r.id}>
                    <SubmitButton variant="secondary" className="btn-sm">
                      Delete
                    </SubmitButton>
                  </BoundForm>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>No redirects.</Empty>
      )}
      <Panel title="Add a redirect" className="mt-6">
        <AdminForm action={saveRedirectAction} className="space-y-3" resetOnSuccess>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextInput name="fromPath" label="Old address" placeholder="/product/old-name" />
            <TextInput name="toPath" label="New address" placeholder="/product/new-name" />
          </div>
          <Checkbox name="permanent" label="Permanent (recommended for renamed pages)" defaultChecked />
          <SubmitButton>Add redirect</SubmitButton>
        </AdminForm>
      </Panel>
    </>
  );
}

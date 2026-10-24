import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/server/db/client";
import { adminCollections } from "@/server/services/admin-catalog";
import { GroupingForm } from "@/components/admin/grouping-form";
import { Badge, Empty, PageHeader, Panel, Table } from "@/components/admin/ui";
import { saveCollectionAction } from "../../_actions/catalog";

export const metadata: Metadata = { title: "Collections" };

export default async function CollectionsPage() {
  const rows = await adminCollections(getDb());
  return (
    <>
      <PageHeader title="Festival and occasion collections" description="Group products for a festival or occasion. Add products to a collection from the product page. Set dates to show a collection only around the festival." />
      {rows.length ? (
        <Table>
          <thead>
            <tr>
              <th>Collection</th>
              <th>Products</th>
              <th>Dates</th>
              <th>Visibility</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ c, productCount }) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/admin/collections/${c.id}`} className="font-semibold hover:text-saffron-dark">
                    {c.name}
                  </Link>
                  <span className="block text-xs text-muted">/collections/{c.slug}</span>
                </td>
                <td>{productCount}</td>
                <td className="text-sm">{c.startsOn || c.endsOn ? `${c.startsOn ?? "any"} to ${c.endsOn ?? "any"}` : "Always"}</td>
                <td>{c.isVisible ? <Badge tone={productCount ? "good" : "warn"}>{productCount ? "Visible" : "No products yet"}</Badge> : <Badge>Hidden</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>No collections yet.</Empty>
      )}
      <Panel title="Add a collection" className="mt-6">
        <GroupingForm id="new" kind="collection" action={saveCollectionAction} values={{ name: "", slug: "", summary: "", intro: "", isVisible: true, sortOrder: rows.length * 10, seoTitle: "", seoDescription: "" }} />
      </Panel>
    </>
  );
}

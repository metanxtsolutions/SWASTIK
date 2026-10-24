import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";
import { getDb } from "@/server/db/client";
import { adminCategories } from "@/server/services/admin-catalog";
import { BoundForm } from "@/components/admin/bound-form";
import { GroupingForm } from "@/components/admin/grouping-form";
import { Badge, PageHeader, Panel, Table } from "@/components/admin/ui";
import { moveCategoryAction, saveCategoryAction } from "../../_actions/catalog";

export const metadata: Metadata = { title: "Categories" };

export default async function CategoriesPage() {
  const rows = await adminCategories(getDb());
  return (
    <>
      <PageHeader title="Categories" description="Categories organise the shop. Empty or hidden categories are not shown to customers or search engines." />
      <Table>
        <thead>
          <tr>
            <th>Order</th>
            <th>Category</th>
            <th>Products</th>
            <th>Visibility</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ c, productCount }, i) => (
            <tr key={c.id}>
              <td>
                <div className="flex gap-1">
                  <BoundForm action={moveCategoryAction} id={c.id}>
                    <input type="hidden" name="direction" value="up" />
                    <button type="submit" disabled={i === 0} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-sand disabled:opacity-30" aria-label={`Move ${c.name} up`}>
                      <ArrowUp aria-hidden className="h-4 w-4" />
                    </button>
                  </BoundForm>
                  <BoundForm action={moveCategoryAction} id={c.id}>
                    <input type="hidden" name="direction" value="down" />
                    <button type="submit" disabled={i === rows.length - 1} className="inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-sand disabled:opacity-30" aria-label={`Move ${c.name} down`}>
                      <ArrowDown aria-hidden className="h-4 w-4" />
                    </button>
                  </BoundForm>
                </div>
              </td>
              <td>
                <Link href={`/admin/categories/${c.id}`} className="font-semibold hover:text-saffron-dark">
                  {c.name}
                </Link>
                <span className="block text-xs text-muted">/category/{c.slug}</span>
              </td>
              <td>{productCount}</td>
              <td>{c.isVisible ? productCount ? <Badge tone="good">Shown</Badge> : <Badge tone="warn">Visible, no products yet</Badge> : <Badge>Hidden</Badge>}</td>
            </tr>
          ))}
        </tbody>
      </Table>
      <Panel title="Add a category" className="mt-6">
        <GroupingForm id="new" kind="category" action={saveCategoryAction} values={{ name: "", slug: "", summary: "", intro: "", isVisible: true, sortOrder: rows.length * 10, seoTitle: "", seoDescription: "" }} />
      </Panel>
    </>
  );
}

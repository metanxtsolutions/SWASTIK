import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Plus } from "lucide-react";
import { getDb } from "@/server/db/client";
import { catalogOptions } from "@/server/admin-data";
import { listAdminProducts } from "@/server/services/admin-catalog";
import { formatINR } from "@/lib/money";
import { Badge, Empty, PageHeader, Table } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Products" };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const db = getDb();
  const [{ rows, total }, opts] = await Promise.all([listAdminProducts(db, { q: sp.q, status: sp.status, categoryId: sp.category, page: Number(sp.page) || 1 }), catalogOptions(db)]);
  return (
    <>
      <PageHeader
        title="Products"
        description={`${total} product${total === 1 ? "" : "s"}. Only published products in visible categories appear in the shop.`}
        actions={
          <Link href="/admin/products/new" className="btn btn-primary btn-sm">
            <Plus aria-hidden className="h-4 w-4" />
            Add product
          </Link>
        }
      />
      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-[1fr_12rem_12rem_auto] sm:items-end">
        <div>
          <label htmlFor="p-q" className="field-label">
            Search
          </label>
          <input id="p-q" name="q" defaultValue={sp.q} placeholder="Name, slug or SKU" className="field-input" />
        </div>
        <div>
          <label htmlFor="p-s" className="field-label">
            Status
          </label>
          <select id="p-s" name="status" defaultValue={sp.status ?? ""} className="field-input">
            <option value="">Draft and published</option>
            <option value="published">Published</option>
            <option value="draft">Draft</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div>
          <label htmlFor="p-c" className="field-label">
            Category
          </label>
          <select id="p-c" name="category" defaultValue={sp.category ?? ""} className="field-input">
            <option value="">All</option>
            {opts.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button className="btn btn-secondary" type="submit">
          Filter
        </button>
      </form>
      {rows.length ? (
        <Table>
          <thead>
            <tr>
              <th>Product</th>
              <th>Category</th>
              <th>Status</th>
              <th>Price from</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ p, categoryName, variantCount, minPrice, totalStock, untracked, imageId }) => (
              <tr key={p.id}>
                <td>
                  <Link href={`/admin/products/${p.id}`} className="flex items-center gap-3 font-semibold hover:text-saffron-dark">
                    <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-sand">{imageId ? <Image src={`/api/media/${imageId}/thumb`} alt="" fill sizes="40px" className="object-cover" /> : null}</span>
                    <span>
                      {p.name}
                      <span className="block text-xs font-normal text-muted">
                        {variantCount} option{variantCount === 1 ? "" : "s"}
                        {p.isFeatured ? " · featured" : ""}
                      </span>
                    </span>
                  </Link>
                </td>
                <td>{categoryName ?? <span className="text-danger">None</span>}</td>
                <td>
                  <Badge tone={p.status === "published" ? "good" : p.status === "draft" ? "warn" : "neutral"}>{p.status}</Badge>
                </td>
                <td>{minPrice !== null ? formatINR(minPrice) : "-"}</td>
                <td>{totalStock !== null ? <span className={totalStock === 0 ? "font-semibold text-danger" : ""}>{totalStock}</span> : untracked ? "Not tracked" : "-"}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>
          No products yet. <Link href="/admin/products/new" className="font-semibold text-saffron-dark underline">Add your first product</Link>.
        </Empty>
      )}
    </>
  );
}

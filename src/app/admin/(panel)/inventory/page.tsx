import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/server/db/client";
import { getSettings } from "@/server/services/settings";
import { listInventory, recentStockMovements } from "@/server/services/admin-catalog";
import { formatDateTime } from "@/lib/dates";
import { AdminForm, SubmitButton } from "@/components/admin/form";
import { Badge, Empty, PageHeader, Panel, Table } from "@/components/admin/ui";
import { setStockAction } from "../../_actions/catalog";

export const metadata: Metadata = { title: "Stock" };

const REASONS: Record<string, string> = { order_placed: "Order placed", order_released: "Order cancelled or expired", admin_adjustment: "Updated by you" };

export default async function InventoryPage({ searchParams }: { searchParams: Promise<{ q?: string; low?: string }> }) {
  const sp = await searchParams;
  const db = getDb();
  const { lowStockThreshold } = await getSettings(db, "checkout");
  const [rows, moves] = await Promise.all([listInventory(db, { q: sp.q, lowOnly: sp.low === "1", threshold: lowStockThreshold }), recentStockMovements(db)]);
  return (
    <>
      <PageHeader title="Stock" description={`Update how many of each option you can sell. Orders reserve stock when placed and return it if cancelled or unpaid. Low stock means ${lowStockThreshold} or fewer.`} />
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="i-q" className="field-label">
            Search
          </label>
          <input id="i-q" name="q" defaultValue={sp.q} placeholder="Product, option or SKU" className="field-input" />
        </div>
        <label className="flex h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="low" value="1" defaultChecked={sp.low === "1"} className="h-4 w-4 accent-[var(--color-saffron)]" />
          Low stock only
        </label>
        <button className="btn btn-secondary" type="submit">
          Filter
        </button>
      </form>
      {rows.length ? (
        <Table>
          <thead>
            <tr>
              <th>Product and option</th>
              <th>SKU</th>
              <th>Status</th>
              <th>Stock</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ v, productName, productId, productStatus }) => (
              <tr key={v.id}>
                <td>
                  <Link href={`/admin/products/${productId}`} className="font-semibold hover:text-saffron-dark">
                    {productName}
                  </Link>
                  {v.label ? <span className="block text-xs text-muted">{v.label}</span> : null}
                </td>
                <td className="font-mono text-xs">{v.sku}</td>
                <td>
                  <Badge tone={productStatus === "published" && v.isActive ? "good" : "neutral"}>{productStatus === "published" ? (v.isActive ? "On sale" : "Option off") : productStatus}</Badge>
                </td>
                <td>
                  {v.trackInventory ? (
                    <AdminForm action={setStockAction} className="flex items-center gap-2">
                      <input type="hidden" name="variantId" value={v.id} />
                      <label className="sr-only" htmlFor={`s-${v.id}`}>
                        Stock for {productName} {v.label}
                      </label>
                      <input id={`s-${v.id}`} name="stock" inputMode="numeric" defaultValue={v.stockQuantity} className={`field-input w-24 ${v.stockQuantity <= lowStockThreshold ? "border-marigold" : ""}`} />
                      <SubmitButton variant="secondary" className="btn-sm">
                        Save
                      </SubmitButton>
                    </AdminForm>
                  ) : (
                    <span className="text-muted">Not tracked</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>No product options found.</Empty>
      )}
      <Panel title="Recent stock changes" className="mt-6">
        {moves.length ? (
          <ul className="divide-y divide-line text-sm">
            {moves.map(({ m, productName, label }) => (
              <li key={m.id} className="flex justify-between gap-3 py-2">
                <span>
                  {productName}
                  {label ? ` (${label})` : ""} <span className="block text-xs text-muted">{REASONS[m.reason] ?? m.reason} · {formatDateTime(m.createdAt)}</span>
                </span>
                <span className={m.delta < 0 ? "font-semibold text-danger" : "font-semibold text-leaf"}>{m.delta > 0 ? `+${m.delta}` : m.delta}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No changes yet.</Empty>
        )}
      </Panel>
    </>
  );
}

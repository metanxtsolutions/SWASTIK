import type { Metadata } from "next";
import Link from "next/link";
import { Download } from "lucide-react";
import { getDb } from "@/server/db/client";
import { expireUnpaidOrders, listOrders, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderFilters } from "@/server/services/orders";
import { formatDateTime, formatDeliveryDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { Badge, Empty, ORDER_TONE, PageHeader, PAYMENT_TONE, Table } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Orders" };

type SP = Record<string, string | undefined>;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const db = getDb();
  await expireUnpaidOrders(db);
  const filters: OrderFilters = {
    q: sp.q,
    status: (sp.status ?? "") as OrderFilters["status"],
    paymentStatus: (sp.payment ?? "") as OrderFilters["paymentStatus"],
    from: sp.from,
    to: sp.to,
    dateField: sp.dateField === "delivery" ? "delivery" : "created",
    page: Number(sp.page) || 1,
  };
  const { rows, total, page, pageSize } = await listOrders(db, filters);
  const qs = new URLSearchParams(Object.entries(sp).filter(([k, v]) => v && k !== "page") as [string, string][]);
  const pageHref = (p: number) => `/admin/orders?${new URLSearchParams({ ...Object.fromEntries(qs), page: String(p) })}`;
  return (
    <>
      <PageHeader
        title="Orders"
        description={`${total} order${total === 1 ? "" : "s"}`}
        actions={
          <a href={`/admin/orders/export?${qs}`} className="btn btn-secondary btn-sm">
            <Download aria-hidden className="h-4 w-4" />
            Export CSV
          </a>
        }
      />
      <form className="card mb-4 grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
        <div className="lg:col-span-2">
          <label htmlFor="o-q" className="field-label">
            Search
          </label>
          <input id="o-q" name="q" defaultValue={sp.q} placeholder="Order number, name, phone, PIN" className="field-input" />
        </div>
        <div>
          <label htmlFor="o-status" className="field-label">
            Status
          </label>
          <select id="o-status" name="status" defaultValue={sp.status ?? ""} className="field-input">
            <option value="">All</option>
            <option value="active">Open (needs action)</option>
            {Object.entries(ORDER_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="o-pay" className="field-label">
            Payment
          </label>
          <select id="o-pay" name="payment" defaultValue={sp.payment ?? ""} className="field-input">
            <option value="">All</option>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="o-df" className="field-label">
            Dates by
          </label>
          <select id="o-df" name="dateField" defaultValue={sp.dateField ?? "created"} className="field-input">
            <option value="created">Order date</option>
            <option value="delivery">Delivery date</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="o-from" className="field-label">
              From
            </label>
            <input id="o-from" type="date" name="from" defaultValue={sp.from} className="field-input" />
          </div>
          <div>
            <label htmlFor="o-to" className="field-label">
              To
            </label>
            <input id="o-to" type="date" name="to" defaultValue={sp.to} className="field-input" />
          </div>
        </div>
        <div className="flex gap-2 lg:col-span-6">
          <button className="btn btn-primary btn-sm" type="submit">
            Filter
          </button>
          <Link href="/admin/orders" className="btn btn-secondary btn-sm">
            Clear
          </Link>
        </div>
      </form>
      {rows.length ? (
        <Table>
          <thead>
            <tr>
              <th>Order</th>
              <th>Customer</th>
              <th>Delivery</th>
              <th>Status</th>
              <th>Payment</th>
              <th className="text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <td>
                  <Link href={`/admin/orders/${o.id}`} className="font-semibold text-saffron-dark hover:underline">
                    {o.orderNumber}
                  </Link>
                  <span className="block text-xs text-muted">{formatDateTime(o.createdAt)}</span>
                </td>
                <td>
                  {o.customerName}
                  <span className="block text-xs text-muted">
                    {o.phone} · {o.pincode}
                  </span>
                </td>
                <td>
                  {formatDeliveryDate(o.deliveryDate)}
                  <span className="block text-xs text-muted">{o.slotLabel}</span>
                </td>
                <td>
                  <Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                </td>
                <td>
                  <Badge tone={PAYMENT_TONE[o.paymentStatus]}>{PAYMENT_STATUS_LABELS[o.paymentStatus]}</Badge>
                  <span className="block text-xs text-muted">{o.paymentMethod === "cod" ? "COD / offline" : "Online"}</span>
                </td>
                <td className="text-right font-semibold">{formatINR(o.totalPaise)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>No orders match these filters.</Empty>
      )}
      {total > pageSize ? (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          {page > 1 ? (
            <Link className="btn btn-secondary btn-sm" href={pageHref(page - 1)}>
              Previous
            </Link>
          ) : null}
          <span>
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          {page * pageSize < total ? (
            <Link className="btn btn-secondary btn-sm" href={pageHref(page + 1)}>
              Next
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

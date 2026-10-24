import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { emailConfigured } from "@/server/notify";
import { gateway } from "@/server/payments";
import { dashboardSummary, expireUnpaidOrders, ORDER_STATUS_LABELS } from "@/server/services/orders";
import { listActiveZones } from "@/server/services/delivery";
import { getAllSettings } from "@/server/services/settings";
import { listProducts } from "@/server/services/catalog";
import { formatDeliveryDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { Badge, Empty, ORDER_TONE, PageHeader, Panel, Stat, Table } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Overview" };

export default async function Dashboard() {
  const db = getDb();
  await expireUnpaidOrders(db);
  const settings = await getAllSettings(db);
  const [s, zones, products] = await Promise.all([dashboardSummary(db, settings.checkout.lowStockThreshold), listActiveZones(db), listProducts(db, { limit: 1 })]);
  const env = getEnv();
  const gw = gateway();

  // Launch blockers the owner can fix, shown until resolved.
  const setup: { text: string; href: string }[] = [];
  if (!products.total) setup.push({ text: "Add and publish your first products", href: "/admin/products/new" });
  if (!zones.length) setup.push({ text: "Activate at least one delivery area with its PIN codes, fee and slots", href: "/admin/delivery" });
  if (!settings.business.phone && !settings.business.whatsapp) setup.push({ text: "Add the business phone or WhatsApp number", href: "/admin/settings" });
  if (!settings.business.notificationEmail) setup.push({ text: "Add an email address for new order alerts", href: "/admin/settings" });
  if (!gw && !settings.checkout.codEnabled) setup.push({ text: "No payment method is available: configure Razorpay or turn on Cash on Delivery", href: "/admin/settings/checkout" });
  if (gw?.isTest && env.APP_STAGE === "production") setup.push({ text: "Online payments are in Razorpay test mode", href: "/admin/settings/checkout" });
  if (!emailConfigured(env)) setup.push({ text: "Email delivery is not configured (SMTP), so customers and you receive no emails", href: "/admin/settings/notifications" });

  return (
    <>
      <PageHeader title="Overview" description="Orders, enquiries and stock at a glance." />
      {setup.length ? (
        <Panel title="To finish setting up" className="mb-6 border-marigold bg-marigold-soft/40">
          <ul className="space-y-2 text-sm">
            {setup.map((x) => (
              <li key={x.text} className="flex items-start gap-2">
                <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-saffron-dark" />
                <Link href={x.href} className="hover:underline">
                  {x.text}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Waiting for your confirmation" value={s.byStatus.pending_confirmation ?? 0} href="/admin/orders?status=pending_confirmation" tone={s.byStatus.pending_confirmation ? "warn" : undefined} />
        <Stat label="Orders in progress" value={s.awaitingAction} href="/admin/orders?status=active" />
        <Stat label="Confirmed" value={s.byStatus.confirmed ?? 0} href="/admin/orders?status=confirmed" />
        <Stat label="Delivered" value={s.byStatus.delivered ?? 0} href="/admin/orders?status=delivered" />
        <Stat label="Cancelled" value={s.byStatus.cancelled ?? 0} href="/admin/orders?status=cancelled" />
        <Stat label="New bulk enquiries" value={s.enquiries.new ?? 0} href="/admin/bulk-enquiries?status=new" tone={s.enquiries.new ? "warn" : undefined} />
        <Stat label="Low stock options" value={s.lowStock.length} href="/admin/inventory?low=1" tone={s.lowStock.length ? "warn" : undefined} />
        <Stat label="Awaiting payment" value={s.byStatus.pending_payment ?? 0} href="/admin/orders?status=pending_payment" />
      </div>

      <Panel title="Sales (paid orders, less refunds)" className="mt-6">
        <div className="grid grid-cols-3 gap-3 text-center">
          {(["today", "7d", "30d"] as const).map((k) => (
            <div key={k}>
              <p className="text-sm text-muted">{k === "today" ? "Today" : k === "7d" ? "Last 7 days" : "Last 30 days"}</p>
              <p className="text-xl font-bold">{formatINR(s.sales[k]?.revenuePaise ?? 0)}</p>
              <p className="text-xs text-muted">{s.sales[k]?.orders ?? 0} orders</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">Cash on Delivery orders count once you record the payment.</p>
      </Panel>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Panel title="Upcoming deliveries" actions={<Link href="/admin/orders?status=active" className="text-sm font-semibold text-saffron-dark hover:underline">All</Link>}>
          {s.upcoming.length ? (
            <Table className="border-0">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Delivery</th>
                  <th>Status</th>
                  <th className="text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {s.upcoming.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/orders/${o.id}`} className="font-semibold text-saffron-dark hover:underline">
                        {o.orderNumber}
                      </Link>
                      <span className="block text-xs text-muted">{o.customerName}</span>
                    </td>
                    <td>
                      {formatDeliveryDate(o.deliveryDate)}
                      <span className="block text-xs text-muted">{o.slotLabel}</span>
                    </td>
                    <td>
                      <Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                    </td>
                    <td className="text-right font-semibold">{formatINR(o.totalPaise)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Empty>No open orders.</Empty>
          )}
        </Panel>
        <Panel title="Low stock" actions={<Link href="/admin/inventory" className="text-sm font-semibold text-saffron-dark hover:underline">Stock</Link>}>
          {s.lowStock.length ? (
            <ul className="divide-y divide-line text-sm">
              {s.lowStock.map((v) => (
                <li key={v.id} className="flex justify-between gap-2 py-2">
                  <Link href={`/admin/products/${v.product_id}`} className="hover:underline">
                    {v.name}
                    {v.label ? ` (${v.label})` : ""}
                  </Link>
                  <span className={Number(v.stock_quantity) === 0 ? "font-bold text-danger" : "font-semibold text-saffron-dark"}>{v.stock_quantity}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nothing is running low (threshold {settings.checkout.lowStockThreshold}).</Empty>
          )}
        </Panel>
      </div>
    </>
  );
}

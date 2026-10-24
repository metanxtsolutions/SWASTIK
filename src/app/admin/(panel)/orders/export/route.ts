import { getDb } from "@/server/db/client";
import { currentAdmin } from "@/server/auth/session";
import { audit } from "@/server/audit";
import { exportOrders, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, type OrderFilters } from "@/server/services/orders";
import { toCsv } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await currentAdmin();
  if (!session) return new Response("Unauthorized", { status: 401 });
  const sp = new URL(req.url).searchParams;
  const filters: OrderFilters = { q: sp.get("q") ?? "", status: (sp.get("status") ?? "") as OrderFilters["status"], paymentStatus: (sp.get("payment") ?? "") as OrderFilters["paymentStatus"], from: sp.get("from") ?? "", to: sp.get("to") ?? "", dateField: sp.get("dateField") === "delivery" ? "delivery" : "created" };
  const db = getDb();
  const rows = await exportOrders(db, filters);
  await audit(db, { actor: `admin:${session.admin.email}`, action: "orders.exported", entityType: "order", details: { count: rows.length, filters } });
  const csv = toCsv(
    ["Order", "Placed", "Status", "Payment", "Method", "Customer", "Phone", "Email", "Address", "Locality", "City", "PIN", "Zone", "Delivery date", "Slot", "Items", "Items total", "Discount", "Delivery fee", "Total", "Refunded", "Promo code", "Notes"],
    rows.map(({ order: o, items }) => [
      o.orderNumber,
      o.createdAt.toISOString(),
      ORDER_STATUS_LABELS[o.status],
      PAYMENT_STATUS_LABELS[o.paymentStatus],
      o.paymentMethod === "cod" ? "Cash on Delivery" : "Online",
      o.customerName,
      o.phone,
      o.email ?? "",
      [o.addressLine1, o.addressLine2, o.landmark].filter(Boolean).join(", "),
      o.locality,
      o.city,
      o.pincode,
      o.zoneName,
      o.deliveryDate,
      o.slotLabel,
      items.map((i) => `${i.quantity} x ${i.productName}${i.variantLabel ? ` (${i.variantLabel})` : ""}`).join("; "),
      (o.subtotalPaise / 100).toFixed(2),
      (o.discountPaise / 100).toFixed(2),
      (o.deliveryFeePaise / 100).toFixed(2),
      (o.totalPaise / 100).toFixed(2),
      (o.refundedPaise / 100).toFixed(2),
      o.couponCode ?? "",
      o.customerNotes,
    ]),
  );
  return new Response(csv, {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="swastik-orders-${new Date().toISOString().slice(0, 10)}.csv"`, "Cache-Control": "no-store" },
  });
}

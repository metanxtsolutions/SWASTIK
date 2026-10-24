import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Clock, MessageCircle, Package, XCircle } from "lucide-react";
import { getDb } from "@/server/db/client";
import { siteData } from "@/server/site";
import { getOrderByAccess, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from "@/server/services/orders";
import { formatDateTime, formatDeliveryDate } from "@/lib/dates";
import { formatINR } from "@/lib/money";
import { formatIndianMobile, whatsappLink } from "@/lib/phone";
import { PaymentPoller, PayNowButton } from "@/components/shop/order-actions";

export const metadata: Metadata = { title: "Your order", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STEPS = ["pending_confirmation", "confirmed", "preparing", "out_for_delivery", "delivered"] as const;

export default async function OrderPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string; paid?: string; payment_error?: string }> }) {
  const { number } = await params;
  const sp = await searchParams;
  const found = await getOrderByAccess(getDb(), number, sp.t);
  // Without the right token the order does not exist for this visitor.
  if (!found) notFound();
  const { order, items, events } = found;
  const site = await siteData();
  const { business } = site.settings;
  const token = sp.t!;
  const wa = business.whatsapp ? whatsappLink(business.whatsapp, `Namaskar, I have a question about my order ${order.orderNumber}.`) : null;
  const awaitingPayment = order.status === "pending_payment";
  const expired = awaitingPayment && order.paymentExpiresAt && order.paymentExpiresAt < new Date();
  const stepIndex = STEPS.indexOf(order.status as (typeof STEPS)[number]);

  let banner: { tone: "ok" | "wait" | "bad"; title: string; body: string };
  if (order.status === "cancelled") banner = { tone: "bad", title: "This order is cancelled", body: order.cancelReason ?? "" };
  else if (awaitingPayment && order.paymentStatus === "failed") banner = { tone: "bad", title: "Payment not completed", body: "Your last payment attempt did not go through. You can try again below." };
  else if (awaitingPayment) banner = { tone: "wait", title: "Waiting for payment", body: "Your order is reserved. Complete the payment to place it." };
  else if (order.status === "delivered") banner = { tone: "ok", title: "Delivered", body: `Thank you for ordering from ${business.name}.` };
  else if (order.status === "pending_confirmation") banner = { tone: "ok", title: order.paymentStatus === "paid" ? "Payment received. Your order is placed." : "Your order is placed", body: "We will confirm it shortly." };
  else banner = { tone: "ok", title: ORDER_STATUS_LABELS[order.status], body: "" };

  return (
    <div className="container-page max-w-4xl py-6">
      <div className={`flex gap-3 rounded-3xl p-5 sm:p-6 ${banner.tone === "ok" ? "bg-leaf-soft" : banner.tone === "wait" ? "bg-marigold-soft" : "bg-danger-soft"}`}>
        {banner.tone === "ok" ? <CheckCircle2 aria-hidden className="h-7 w-7 shrink-0 text-leaf" /> : banner.tone === "wait" ? <Clock aria-hidden className="h-7 w-7 shrink-0 text-saffron-dark" /> : <XCircle aria-hidden className="h-7 w-7 shrink-0 text-danger" />}
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold sm:text-3xl">{banner.title}</h1>
          {banner.body ? <p className="text-ink-soft">{banner.body}</p> : null}
          <p className="text-sm">
            Order number <span className="font-mono text-base font-bold tracking-wide">{order.orderNumber}</span>
          </p>
          {awaitingPayment && sp.paid ? <PaymentPoller orderNumber={order.orderNumber} token={token} /> : null}
          {awaitingPayment && sp.payment_error ? <p className="text-sm font-medium text-danger">The payment window could not be opened. Please try again.</p> : null}
          {awaitingPayment && !expired && !sp.paid ? (
            <div className="flex flex-wrap items-center gap-3 pt-1">
              <PayNowButton orderNumber={order.orderNumber} token={token} label={`Pay ${formatINR(order.totalPaise)}`} />
              {order.paymentExpiresAt ? <span className="text-sm text-muted">Pay before {formatDateTime(order.paymentExpiresAt)} to keep this order.</span> : null}
            </div>
          ) : null}
          {expired ? <p className="text-sm font-medium">The time to pay has passed. Please place a new order.</p> : null}
          {order.paymentStatus === "refund_pending" ? (
            <p className="flex items-center gap-2 text-sm font-medium">
              <AlertTriangle aria-hidden className="h-4 w-4" />A refund is due for this order and will be processed.
            </p>
          ) : null}
        </div>
      </div>

      <p className="mt-3 text-sm text-muted">Bookmark this page to check your order later. You can also use Track Order with your order number and mobile number.</p>

      {order.status !== "cancelled" && !awaitingPayment ? (
        <ol className="mt-6 grid grid-cols-5 gap-1 text-center text-[0.7rem] sm:text-xs" aria-label="Order progress">
          {STEPS.map((s, i) => (
            <li key={s} aria-current={i === stepIndex ? "step" : undefined}>
              <span className={`mx-auto mb-1.5 block h-1.5 rounded-full ${i <= stepIndex ? "bg-leaf" : "bg-sand-deep"}`} />
              <span className={i <= stepIndex ? "font-semibold text-ink" : "text-muted"}>{s === "pending_confirmation" ? "Placed" : ORDER_STATUS_LABELS[s]}</span>
            </li>
          ))}
        </ol>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <section className="card p-5" aria-labelledby="o-delivery">
          <h2 id="o-delivery" className="font-sans text-base font-semibold">
            Delivery
          </h2>
          <p className="mt-2 font-semibold">
            {formatDeliveryDate(order.deliveryDate, { withYear: true })}
            {order.slotLabel ? `, ${order.slotLabel}` : ""}
          </p>
          <address className="mt-2 text-sm not-italic text-ink-soft">
            {order.customerName}
            <br />
            {order.addressLine1}
            {order.addressLine2 ? (
              <>
                <br />
                {order.addressLine2}
              </>
            ) : null}
            <br />
            {order.locality}, {order.city} {order.pincode}
            {order.landmark ? (
              <>
                <br />
                Near {order.landmark}
              </>
            ) : null}
            <br />
            {formatIndianMobile(order.phone)}
          </address>
        </section>
        <section className="card p-5" aria-labelledby="o-payment">
          <h2 id="o-payment" className="font-sans text-base font-semibold">
            Payment
          </h2>
          <p className="mt-2 text-sm">{order.paymentMethod === "cod" ? "Cash on Delivery" : "Online payment"}</p>
          <p className="text-sm font-semibold">{PAYMENT_STATUS_LABELS[order.paymentStatus]}</p>
          {order.refundedPaise ? <p className="text-sm text-muted">Refunded {formatINR(order.refundedPaise)}</p> : null}
          <div className="mt-4 space-y-2 text-sm">
            <p className="font-semibold">Need help with this order?</p>
            <div className="flex flex-wrap gap-2">
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                  <MessageCircle aria-hidden className="h-4 w-4 text-leaf" />
                  WhatsApp us
                </a>
              ) : null}
              {business.phone ? (
                <a href={`tel:${business.phone.replace(/[^\d+]/g, "")}`} className="btn btn-secondary btn-sm">
                  Call {business.phone}
                </a>
              ) : null}
              <Link href={`/contact?order=${order.orderNumber}`} className="btn btn-secondary btn-sm">
                Send a message
              </Link>
            </div>
          </div>
        </section>
      </div>

      <section className="card mt-4 p-5" aria-labelledby="o-items">
        <h2 id="o-items" className="flex items-center gap-2 font-sans text-base font-semibold">
          <Package aria-hidden className="h-4 w-4" />
          Items
        </h2>
        <ul className="mt-3 divide-y divide-line text-sm">
          {items.map((i) => (
            <li key={i.id} className="flex justify-between gap-3 py-2.5">
              <span>
                <span className="font-medium">
                  {i.productName}
                  {i.variantLabel ? ` (${i.variantLabel})` : ""}
                </span>
                <span className="block text-muted">
                  {i.quantity} × {formatINR(i.unitPricePaise)} per {i.unitLabel}
                </span>
              </span>
              <span className="font-semibold">{formatINR(i.lineTotalPaise)}</span>
            </li>
          ))}
        </ul>
        <dl className="mt-2 space-y-1.5 border-t border-line pt-3 text-sm">
          <div className="flex justify-between">
            <dt>Items</dt>
            <dd>{formatINR(order.subtotalPaise)}</dd>
          </div>
          {order.discountPaise ? (
            <div className="flex justify-between text-leaf">
              <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</dt>
              <dd>-{formatINR(order.discountPaise)}</dd>
            </div>
          ) : null}
          <div className="flex justify-between">
            <dt>Delivery</dt>
            <dd>{order.deliveryFeePaise ? formatINR(order.deliveryFeePaise) : "Free"}</dd>
          </div>
          <div className="flex justify-between text-base font-bold">
            <dt>Total</dt>
            <dd>{formatINR(order.totalPaise)}</dd>
          </div>
        </dl>
      </section>

      {events.length ? (
        <section className="mt-4 p-1" aria-labelledby="o-history">
          <h2 id="o-history" className="font-sans text-base font-semibold">
            Updates
          </h2>
          <ol className="mt-3 space-y-3 border-l-2 border-line pl-4 text-sm">
            {[...events].reverse().map((e) => (
              <li key={e.id}>
                <p className="font-medium">{e.message}</p>
                <p className="text-xs text-muted">{formatDateTime(e.createdAt)}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { getDb } from "@/server/db/client";
import { getOrderForAdmin, NEXT_STATUSES, ORDER_STATUS_LABELS, orderLink, PAYMENT_STATUS_LABELS } from "@/server/services/orders";
import { getEnv } from "@/server/env";
import { formatDateTime, formatDeliveryDate } from "@/lib/dates";
import { formatINR, paiseToRupeesInput } from "@/lib/money";
import { formatIndianMobile, whatsappLink } from "@/lib/phone";
import { BoundForm } from "@/components/admin/bound-form";
import { Checkbox, SubmitButton, TextArea, TextInput } from "@/components/admin/form";
import { Badge, ORDER_TONE, PageHeader, Panel, PAYMENT_TONE } from "@/components/admin/ui";
import { addOrderNoteAction, recordPaymentAction, refundAction, updateOrderStatusAction } from "../../../_actions/orders";

export const metadata: Metadata = { title: "Order" };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getOrderForAdmin(getDb(), id);
  if (!data) notFound();
  const { order: o, items, events, payments, refunds, notifications } = data;
  const next = NEXT_STATUSES[o.status].filter((s) => s !== "cancelled");
  const canCancel = NEXT_STATUSES[o.status].includes("cancelled");
  const captured = payments.filter((p) => p.status === "captured").reduce((s, p) => s + p.amountPaise, 0);
  const refundable = captured - refunds.filter((r) => r.status !== "failed").reduce((s, r) => s + r.amountPaise, 0);
  const customerWa = whatsappLink(o.phone, `Namaskar ${o.customerName}, this is about your Swastik order ${o.orderNumber}.`);
  const customerLink = `${getEnv().APP_URL}${orderLink(o)}`;

  return (
    <>
      <PageHeader
        back={{ href: "/admin/orders", label: "Orders" }}
        title={`Order ${o.orderNumber}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={ORDER_TONE[o.status]}>{ORDER_STATUS_LABELS[o.status]}</Badge>
            <Badge tone={PAYMENT_TONE[o.paymentStatus]}>{PAYMENT_STATUS_LABELS[o.paymentStatus]}</Badge>
            <span>Placed {formatDateTime(o.createdAt)}</span>
            {o.source !== "web" ? <Badge tone="info">{o.source === "bulk_enquiry" ? "From bulk enquiry" : "Entered by shop"}</Badge> : null}
          </span>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Panel title="Items">
            <ul className="divide-y divide-line text-sm">
              {items.map((i) => (
                <li key={i.id} className="flex justify-between gap-3 py-2.5">
                  <span>
                    <span className="font-semibold">
                      {i.quantity} × {i.productName}
                      {i.variantLabel ? ` (${i.variantLabel})` : ""}
                    </span>
                    <span className="block text-muted">
                      {formatINR(i.unitPricePaise)} per {i.unitLabel} · SKU {i.sku}
                    </span>
                  </span>
                  <span className="font-semibold">{formatINR(i.lineTotalPaise)}</span>
                </li>
              ))}
            </ul>
            <dl className="mt-2 space-y-1 border-t border-line pt-3 text-sm">
              <div className="flex justify-between">
                <dt>Items</dt>
                <dd>{formatINR(o.subtotalPaise)}</dd>
              </div>
              {o.discountPaise ? (
                <div className="flex justify-between">
                  <dt>Discount {o.couponCode ? `(${o.couponCode})` : ""}</dt>
                  <dd>-{formatINR(o.discountPaise)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between">
                <dt>Delivery</dt>
                <dd>{formatINR(o.deliveryFeePaise)}</dd>
              </div>
              <div className="flex justify-between text-base font-bold">
                <dt>Total</dt>
                <dd>{formatINR(o.totalPaise)}</dd>
              </div>
              {o.refundedPaise ? (
                <div className="flex justify-between text-danger">
                  <dt>Refunded</dt>
                  <dd>-{formatINR(o.refundedPaise)}</dd>
                </div>
              ) : null}
            </dl>
          </Panel>

          <Panel title="Customer and delivery">
            <div className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <p className="font-semibold">{o.customerName}</p>
                <p>{formatIndianMobile(o.phone)}</p>
                {o.email ? <p className="break-all">{o.email}</p> : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={`tel:+91${o.phone}`} className="btn btn-secondary btn-sm">
                    <Phone aria-hidden className="h-4 w-4" />
                    Call
                  </a>
                  {customerWa ? (
                    <a href={customerWa} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                      <MessageCircle aria-hidden className="h-4 w-4 text-leaf" />
                      WhatsApp{o.whatsappConsent ? "" : " (no consent given)"}
                    </a>
                  ) : null}
                  {o.email ? (
                    <a href={`mailto:${o.email}?subject=${encodeURIComponent(`Your order ${o.orderNumber}`)}`} className="btn btn-secondary btn-sm">
                      <Mail aria-hidden className="h-4 w-4" />
                      Email
                    </a>
                  ) : null}
                </div>
              </div>
              <div>
                <p className="font-semibold">
                  {formatDeliveryDate(o.deliveryDate, { withYear: true })}
                  {o.slotLabel ? `, ${o.slotLabel}` : ""}
                </p>
                <p>
                  {o.addressLine1}
                  {o.addressLine2 ? `, ${o.addressLine2}` : ""}
                </p>
                <p>
                  {o.locality}, {o.city} {o.pincode}
                </p>
                {o.landmark ? <p>Near {o.landmark}</p> : null}
                <p className="text-muted">Zone: {o.zoneName}</p>
              </div>
            </div>
            {o.customerNotes ? <p className="mt-3 rounded-xl bg-marigold-soft p-3 text-sm">Customer note: {o.customerNotes}</p> : null}
            <p className="mt-3 text-xs text-muted">
              Customer&apos;s order link (share only with this customer): <span className="break-all">{customerLink}</span>
            </p>
          </Panel>

          <Panel title="History and notes">
            <BoundForm action={addOrderNoteAction} id={o.id} className="mb-4 space-y-2" resetOnSuccess>
              <TextArea name="note" label="Add an internal note" rows={2} hint="Only you can see internal notes." />
              <SubmitButton variant="secondary" className="btn-sm">
                Add note
              </SubmitButton>
            </BoundForm>
            <ol className="space-y-3 border-l-2 border-line pl-4 text-sm">
              {events.map((e) => (
                <li key={e.id}>
                  <p>
                    {e.message} {e.isInternal ? <Badge>internal</Badge> : null}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(e.createdAt)} · {e.actor}
                  </p>
                </li>
              ))}
            </ol>
          </Panel>
        </div>

        <div className="space-y-5">
          {next.length || canCancel ? (
            <Panel title="Update status">
              {next.length ? (
                <BoundForm action={updateOrderStatusAction} id={o.id} className="space-y-3">
                  <fieldset>
                    <legend className="field-label">Move to</legend>
                    <div className="space-y-2">
                      {next.map((s, i) => (
                        <label key={s} className="flex items-center gap-2 text-sm">
                          <input type="radio" name="status" value={s} defaultChecked={i === 0} className="h-4 w-4 accent-[var(--color-saffron)]" />
                          {ORDER_STATUS_LABELS[s]}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <TextInput name="note" label="Message to show the customer (optional)" />
                  <Checkbox name="notify" label="Email the customer about this update" defaultChecked={!!o.email} hint={o.email ? undefined : "No email address on this order."} />
                  <SubmitButton>Update status</SubmitButton>
                </BoundForm>
              ) : null}
              {o.status === "pending_payment" ? <p className="mb-3 text-sm text-muted">This order is waiting for online payment. It is cancelled automatically if the payment window passes.</p> : null}
              {canCancel ? (
                <details className="mt-4 rounded-xl border border-line p-3">
                  <summary className="cursor-pointer text-sm font-semibold text-danger">Cancel this order</summary>
                  <BoundForm action={updateOrderStatusAction} id={o.id} className="mt-3 space-y-3">
                    <input type="hidden" name="status" value="cancelled" />
                    <TextInput name="cancelReason" label="Reason (shown to the customer)" required />
                    <Checkbox name="notify" label="Email the customer" defaultChecked={!!o.email} />
                    <SubmitButton variant="danger" confirm="Cancel this order? Reserved stock will be released.">
                      Cancel order
                    </SubmitButton>
                  </BoundForm>
                </details>
              ) : null}
            </Panel>
          ) : null}

          <Panel title="Payment">
            <p className="text-sm">
              {o.paymentMethod === "cod" ? "Cash on Delivery / offline" : "Online"} · <Badge tone={PAYMENT_TONE[o.paymentStatus]}>{PAYMENT_STATUS_LABELS[o.paymentStatus]}</Badge>
            </p>
            {payments.length ? (
              <ul className="mt-3 space-y-2 text-sm">
                {payments.map((p) => (
                  <li key={p.id} className="rounded-xl bg-sand/60 p-2.5">
                    <span className="font-semibold">{formatINR(p.amountPaise)}</span> · {p.provider}
                    {p.isTest ? " (test)" : ""} · {p.status}
                    {p.method ? ` · ${p.method}` : ""}
                    {p.providerPaymentId ? <span className="block break-all text-xs text-muted">Payment ref {p.providerPaymentId}</span> : null}
                    {p.failureReason ? <span className="block text-xs text-danger">{p.failureReason}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {o.paymentMethod === "cod" && o.paymentStatus === "unpaid" && o.status !== "cancelled" ? (
              <BoundForm action={recordPaymentAction} id={o.id} className="mt-4 space-y-3">
                <p className="text-sm font-semibold">Record payment received ({formatINR(o.totalPaise)})</p>
                <div className="grid grid-cols-2 gap-2">
                  <label className="text-sm">
                    <span className="field-label">Method</span>
                    <select name="method" className="field-input">
                      <option value="cash">Cash</option>
                      <option value="upi">UPI to shop</option>
                      <option value="bank_transfer">Bank transfer</option>
                    </select>
                  </label>
                  <TextInput name="reference" label="Reference (optional)" />
                </div>
                <SubmitButton variant="secondary">Mark as paid</SubmitButton>
              </BoundForm>
            ) : null}
            {refundable > 0 ? (
              <details className="mt-4 rounded-xl border border-line p-3" open={o.paymentStatus === "refund_pending"}>
                <summary className="cursor-pointer text-sm font-semibold">Refund</summary>
                <BoundForm action={refundAction} id={o.id} className="mt-3 space-y-3">
                  <TextInput name="amount" label={`Amount in rupees (up to ${formatINR(refundable)})`} inputMode="decimal" defaultValue={paiseToRupeesInput(refundable)} />
                  <TextInput name="reason" label="Reason" required />
                  <p className="text-xs text-muted">{payments.some((p) => p.providerPaymentId && p.status === "captured") ? "Online payments are refunded through the payment gateway." : "This records a refund you have paid back to the customer yourself."}</p>
                  <SubmitButton variant="danger" confirm="Send this refund?">
                    Refund
                  </SubmitButton>
                </BoundForm>
              </details>
            ) : null}
            {refunds.length ? (
              <ul className="mt-3 space-y-1 text-sm">
                {refunds.map((r) => (
                  <li key={r.id}>
                    Refund {formatINR(r.amountPaise)} · {r.status} · {r.reason}
                  </li>
                ))}
              </ul>
            ) : null}
          </Panel>

          <Panel title="Notifications" description="Email is sent only when SMTP is configured. WhatsApp and SMS messages are not sent automatically; use the buttons above.">
            {notifications.length ? (
              <ul className="space-y-1.5 text-sm">
                {notifications.map((n) => (
                  <li key={n.id} className="flex justify-between gap-2">
                    <span>
                      {n.subject} <span className="block text-xs text-muted">to {n.recipient}</span>
                    </span>
                    <Badge tone={n.status === "sent" ? "good" : n.status === "failed" ? "bad" : "neutral"}>{n.status === "not_configured" ? "not sent: email not set up" : n.status === "stored" ? "stored (test)" : n.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No messages for this order.</p>
            )}
          </Panel>
          {o.bulkEnquiryId ? (
            <p className="text-sm">
              <Link href={`/admin/bulk-enquiries/${o.bulkEnquiryId}`} className="font-semibold text-saffron-dark hover:underline">
                View the bulk enquiry
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}

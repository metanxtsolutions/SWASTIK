import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { MessageCircle, Phone } from "lucide-react";
import { getDb } from "@/server/db/client";
import { ENQUIRY_STATUS_LABELS, FREQUENCY_LABELS, getEnquiry } from "@/server/services/bulk";
import { formatDateTime, formatDeliveryDate } from "@/lib/dates";
import { formatINR, paiseToRupeesInput } from "@/lib/money";
import { formatIndianMobile, whatsappLink } from "@/lib/phone";
import { BoundForm } from "@/components/admin/bound-form";
import { Checkbox, Select, SubmitButton, TextArea, TextInput } from "@/components/admin/form";
import { Badge, ENQUIRY_TONE, PageHeader, Panel, Table } from "@/components/admin/ui";
import { updateEnquiryAction } from "../../../_actions/ops";
import { createOrderFromEnquiryAction } from "../../../_actions/orders";

export const metadata: Metadata = { title: "Bulk enquiry" };

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getEnquiry(getDb(), id);
  if (!data) notFound();
  const { enquiry: e, items, notes, notifications, order } = data;
  const wa = whatsappLink(e.phone, `Namaskar ${e.contactName}, this is Swastik about your bulk flower enquiry ${e.reference}.`);
  const rows = [...items.map((i) => ({ description: `${i.flower}${i.notes ? ` (${i.notes})` : ""}`, quantity: Number(i.quantity), unit: i.unit })), ...Array.from({ length: 3 }, () => ({ description: "", quantity: 0, unit: "" }))];
  return (
    <>
      <PageHeader
        back={{ href: "/admin/bulk-enquiries", label: "Bulk enquiries" }}
        title={e.institutionName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={ENQUIRY_TONE[e.status]}>{ENQUIRY_STATUS_LABELS[e.status]}</Badge>
            {e.reference} · received {formatDateTime(e.createdAt)}
          </span>
        }
      />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Panel title="Requested flowers">
            <Table className="border-0">
              <thead>
                <tr>
                  <th>Flower</th>
                  <th>Quantity</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td className="font-semibold">{i.flower}</td>
                    <td>
                      {Number(i.quantity)} {i.unit}
                    </td>
                    <td className="text-muted">{i.notes}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
            <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted">Needed on</dt>
                <dd className="font-semibold">
                  {formatDeliveryDate(e.deliveryDate, { withYear: true })}
                  {e.preferredTime ? `, ${e.preferredTime}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Requirement</dt>
                <dd className="font-semibold">
                  {FREQUENCY_LABELS[e.frequency]}
                  {e.recurringDetails ? `: ${e.recurringDetails}` : ""}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted">Delivery address</dt>
                <dd>
                  {e.address}, {e.pincode}
                </dd>
              </div>
              {e.instructions ? (
                <div className="sm:col-span-2">
                  <dt className="text-muted">Instructions</dt>
                  <dd>{e.instructions}</dd>
                </div>
              ) : null}
            </dl>
          </Panel>

          <Panel title="Notes, quotations and follow-ups">
            <ol className="space-y-3 border-l-2 border-line pl-4 text-sm">
              {notes.length ? (
                notes.map((n) => (
                  <li key={n.id}>
                    <p>
                      <Badge tone={n.kind === "quotation" ? "info" : n.kind === "follow_up" ? "warn" : "neutral"}>{n.kind.replace("_", " ")}</Badge> {n.body}
                    </p>
                    <p className="text-xs text-muted">{formatDateTime(n.createdAt)}</p>
                  </li>
                ))
              ) : (
                <li className="text-muted">Nothing recorded yet.</li>
              )}
            </ol>
          </Panel>

          {e.status !== "converted" && !order ? (
            <Panel title="Create an order from this enquiry" description="When the customer accepts your quotation, record the confirmed order here. It appears in Orders with status Confirmed.">
              <BoundForm action={createOrderFromEnquiryAction} id={e.id} className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextInput name="customerName" label="Customer or institution" defaultValue={e.institutionName} />
                  <TextInput name="phone" label="Mobile" defaultValue={e.phone} />
                  <TextInput name="email" label="Email" defaultValue={e.email ?? ""} />
                  <TextInput name="pincode" label="PIN code" defaultValue={e.pincode} />
                </div>
                <TextInput name="address" label="Delivery address" defaultValue={e.address} />
                <div className="grid gap-3 sm:grid-cols-3">
                  <TextInput name="locality" label="Locality" />
                  <TextInput name="city" label="Town or city" />
                  <TextInput name="deliveryDate" label="Delivery date" type="date" defaultValue={e.deliveryDate} />
                </div>
                <TextInput name="slotLabel" label="Delivery time" defaultValue={e.preferredTime} />
                <fieldset>
                  <legend className="field-label">Agreed lines (leave unused rows empty)</legend>
                  <div className="space-y-2">
                    {rows.map((r, i) => (
                      <div key={i} className="grid grid-cols-[2fr_0.7fr_0.8fr_0.9fr] gap-2">
                        <input name={`item_${i}_description`} defaultValue={r.description} placeholder="Description" className="field-input" aria-label={`Line ${i + 1} description`} />
                        <input name={`item_${i}_quantity`} defaultValue={r.quantity || ""} placeholder="Qty" inputMode="numeric" className="field-input" aria-label={`Line ${i + 1} quantity`} />
                        <input name={`item_${i}_unit`} defaultValue={r.unit} placeholder="Unit" className="field-input" aria-label={`Line ${i + 1} unit`} />
                        <input name={`item_${i}_price`} placeholder="₹ per unit" inputMode="decimal" className="field-input" aria-label={`Line ${i + 1} price per unit in rupees`} />
                      </div>
                    ))}
                  </div>
                  <p className="field-hint">Quantities must be whole numbers. For 2.5 kg, use 5 × 500 g.</p>
                </fieldset>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextInput name="deliveryFee" label="Delivery charge (₹)" defaultValue="0" inputMode="decimal" />
                  <div className="pt-7">
                    <Checkbox name="paid" label="Payment already received" />
                  </div>
                </div>
                <TextArea name="notes" label="Order notes" rows={2} defaultValue={e.instructions} />
                <SubmitButton>Create confirmed order</SubmitButton>
              </BoundForm>
            </Panel>
          ) : null}
        </div>

        <div className="space-y-5">
          <Panel title="Contact">
            <p className="font-semibold">{e.contactName}</p>
            <p className="text-sm">{formatIndianMobile(e.phone)}</p>
            {e.email ? <p className="break-all text-sm">{e.email}</p> : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <a href={`tel:+91${e.phone}`} className="btn btn-secondary btn-sm">
                <Phone aria-hidden className="h-4 w-4" />
                Call
              </a>
              {wa ? (
                <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                  <MessageCircle aria-hidden className="h-4 w-4 text-leaf" />
                  WhatsApp
                </a>
              ) : null}
            </div>
          </Panel>
          {order ? (
            <Panel title="Order">
              <Link href={`/admin/orders/${order.id}`} className="font-semibold text-saffron-dark hover:underline">
                {order.orderNumber}
              </Link>
            </Panel>
          ) : null}
          <Panel title="Update">
            <BoundForm action={updateEnquiryAction} id={e.id} className="space-y-3">
              <Select name="status" label="Status" defaultValue={e.status} options={Object.entries(ENQUIRY_STATUS_LABELS).map(([value, label]) => ({ value, label }))} />
              <TextInput name="quotedAmount" label="Quotation amount (₹, optional)" defaultValue={paiseToRupeesInput(e.quotedAmountPaise)} inputMode="decimal" hint={e.quotedAmountPaise ? `Currently ${formatINR(e.quotedAmountPaise)}` : undefined} />
              <TextInput name="nextFollowUpAt" label="Next follow-up (optional)" type="date" defaultValue={e.nextFollowUpAt ? e.nextFollowUpAt.toISOString().slice(0, 10) : ""} />
              <Select name="noteKind" label="Note type" options={[{ value: "note", label: "Note" }, { value: "quotation", label: "Quotation details" }, { value: "follow_up", label: "Follow-up" }]} />
              <TextArea name="note" label="Note (optional)" rows={3} />
              <SubmitButton>Save</SubmitButton>
            </BoundForm>
          </Panel>
          <Panel title="Emails">
            {notifications.length ? (
              <ul className="space-y-1 text-sm">
                {notifications.map((n) => (
                  <li key={n.id}>
                    {n.subject} <Badge tone={n.status === "sent" ? "good" : n.status === "failed" ? "bad" : "neutral"}>{n.status === "not_configured" ? "email not set up" : n.status}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">None.</p>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}

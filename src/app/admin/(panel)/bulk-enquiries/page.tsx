import type { Metadata } from "next";
import Link from "next/link";
import { getDb } from "@/server/db/client";
import { ENQUIRY_STATUS_LABELS, FREQUENCY_LABELS, listEnquiries, type EnquiryStatus } from "@/server/services/bulk";
import { formatDateTime, formatDeliveryDate } from "@/lib/dates";
import { Badge, Empty, ENQUIRY_TONE, PageHeader, Table } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Bulk enquiries" };

export default async function EnquiriesPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const sp = await searchParams;
  const { rows, total } = await listEnquiries(getDb(), { status: (sp.status ?? "") as EnquiryStatus | "", q: sp.q, page: Number(sp.page) || 1 });
  return (
    <>
      <PageHeader title="Bulk enquiries" description={`${total} enquir${total === 1 ? "y" : "ies"} from mandirs and large buyers.`} />
      <form className="card mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="min-w-[14rem] flex-1">
          <label htmlFor="e-q" className="field-label">
            Search
          </label>
          <input id="e-q" name="q" defaultValue={sp.q} placeholder="Reference, name, phone, PIN" className="field-input" />
        </div>
        <div>
          <label htmlFor="e-s" className="field-label">
            Status
          </label>
          <select id="e-s" name="status" defaultValue={sp.status ?? ""} className="field-input">
            <option value="">All</option>
            {Object.entries(ENQUIRY_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
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
              <th>Enquiry</th>
              <th>Contact</th>
              <th>Needed on</th>
              <th>Requirement</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ e, itemCount }) => (
              <tr key={e.id}>
                <td>
                  <Link href={`/admin/bulk-enquiries/${e.id}`} className="font-semibold text-saffron-dark hover:underline">
                    {e.institutionName}
                  </Link>
                  <span className="block text-xs text-muted">
                    {e.reference} · {formatDateTime(e.createdAt)}
                  </span>
                </td>
                <td>
                  {e.contactName}
                  <span className="block text-xs text-muted">
                    {e.phone} · {e.pincode}
                  </span>
                </td>
                <td>{formatDeliveryDate(e.deliveryDate, { withYear: true })}</td>
                <td>
                  {itemCount} variet{itemCount === 1 ? "y" : "ies"}
                  <span className="block text-xs text-muted">{FREQUENCY_LABELS[e.frequency]}</span>
                </td>
                <td>
                  <Badge tone={ENQUIRY_TONE[e.status]}>{ENQUIRY_STATUS_LABELS[e.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>No enquiries yet. They appear here when someone submits the form on the Bulk orders page.</Empty>
      )}
    </>
  );
}

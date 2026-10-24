import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { listAudit } from "@/server/services/admin-ops";
import { formatDateTime } from "@/lib/dates";
import { Empty, PageHeader, Table } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Activity log" };

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const page = Math.max(1, Number((await searchParams).page) || 1);
  const rows = await listAudit(getDb(), page);
  return (
    <>
      <PageHeader title="Activity log" description="Sign-ins and changes to orders, products, prices, delivery and settings." />
      {rows.length ? (
        <Table>
          <thead>
            <tr>
              <th>When</th>
              <th>Who</th>
              <th>What</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap text-xs">{formatDateTime(r.createdAt)}</td>
                <td className="text-xs">{r.actor}</td>
                <td className="text-sm">
                  {r.action}
                  <span className="block text-xs text-muted">{r.entityType}</span>
                </td>
                <td className="max-w-xs truncate font-mono text-xs text-muted">{Object.keys(r.details).length ? JSON.stringify(r.details) : ""}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      ) : (
        <Empty>No activity yet.</Empty>
      )}
      <div className="mt-4 flex justify-center gap-3">
        {page > 1 ? (
          <a className="btn btn-secondary btn-sm" href={`/admin/activity?page=${page - 1}`}>
            Newer
          </a>
        ) : null}
        {rows.length === 100 ? (
          <a className="btn btn-secondary btn-sm" href={`/admin/activity?page=${page + 1}`}>
            Older
          </a>
        ) : null}
      </div>
    </>
  );
}

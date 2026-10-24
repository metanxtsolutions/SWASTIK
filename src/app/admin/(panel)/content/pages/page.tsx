import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { asc } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { pages } from "@/server/db/schema";
import { formatDateTime } from "@/lib/dates";
import { Badge, PageHeader, Table } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Pages" };

export default async function PagesList() {
  const rows = await getDb().select().from(pages).orderBy(asc(pages.title));
  return (
    <>
      <PageHeader
        back={{ href: "/admin/content", label: "Website content" }}
        title="Pages and policies"
        description="Starter drafts are provided. Replace every [[confirm: ...]] note with your own details before publishing; a lawyer should review policies."
        actions={
          <Link href="/admin/content/pages/new" className="btn btn-primary btn-sm">
            <Plus aria-hidden className="h-4 w-4" />
            New page
          </Link>
        }
      />
      <Table>
        <thead>
          <tr>
            <th>Page</th>
            <th>Address</th>
            <th>Status</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/admin/content/pages/${p.id}`} className="font-semibold text-saffron-dark hover:underline">
                  {p.title}
                </Link>
              </td>
              <td className="text-sm">/{p.slug}</td>
              <td>{p.isPublished ? <Badge tone="good">Published</Badge> : /\[\[confirm:/.test(p.body) ? <Badge tone="warn">Draft, needs your details</Badge> : <Badge>Draft</Badge>}</td>
              <td className="text-xs">{formatDateTime(p.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

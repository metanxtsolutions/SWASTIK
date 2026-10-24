import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { desc } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { articles } from "@/server/db/schema";
import { formatDateTime } from "@/lib/dates";
import { Badge, PageHeader, Table } from "@/components/admin/ui";

export const metadata: Metadata = { title: "Guides" };

export default async function GuidesList() {
  const rows = await getDb().select().from(articles).orderBy(desc(articles.updatedAt));
  return (
    <>
      <PageHeader
        back={{ href: "/admin/content", label: "Website content" }}
        title="Guides"
        description="Starter guides are saved as drafts. Read and adjust them to match your knowledge and traditions before publishing."
        actions={
          <Link href="/admin/content/guides/new" className="btn btn-primary btn-sm">
            <Plus aria-hidden className="h-4 w-4" />
            New guide
          </Link>
        }
      />
      <Table>
        <thead>
          <tr>
            <th>Guide</th>
            <th>Status</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>
                <Link href={`/admin/content/guides/${a.id}`} className="font-semibold text-saffron-dark hover:underline">
                  {a.title}
                </Link>
                <span className="block text-xs text-muted">/guides/{a.slug}</span>
              </td>
              <td>{a.status === "published" ? <Badge tone="good">Published</Badge> : <Badge tone="warn">{a.status}</Badge>}</td>
              <td className="text-xs">{formatDateTime(a.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </>
  );
}

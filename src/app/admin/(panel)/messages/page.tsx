import type { Metadata } from "next";
import { getDb } from "@/server/db/client";
import { listMessages } from "@/server/services/admin-ops";
import { formatDateTime } from "@/lib/dates";
import { whatsappLink } from "@/lib/phone";
import { BoundForm } from "@/components/admin/bound-form";
import { SubmitButton } from "@/components/admin/form";
import { Badge, Empty, PageHeader } from "@/components/admin/ui";
import { resolveMessageAction } from "../../_actions/ops";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const rows = await listMessages(getDb());
  return (
    <>
      <PageHeader title="Messages" description="Messages sent through the Contact page." />
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((m) => {
            const wa = whatsappLink(m.phone, `Namaskar ${m.name}, this is Swastik replying to your message.`);
            return (
              <li key={m.id} className={`card p-4 ${m.isResolved ? "opacity-70" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">
                      {m.name} {m.isResolved ? <Badge>resolved</Badge> : <Badge tone="warn">open</Badge>}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDateTime(m.createdAt)} · {m.phone}
                      {m.email ? ` · ${m.email}` : ""}
                      {m.orderNumber ? ` · order ${m.orderNumber}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a href={`tel:+91${m.phone}`} className="btn btn-secondary btn-sm">
                      Call
                    </a>
                    {wa ? (
                      <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn-secondary btn-sm">
                        WhatsApp
                      </a>
                    ) : null}
                    <BoundForm action={resolveMessageAction} id={m.id}>
                      <input type="hidden" name="resolved" value={m.isResolved ? "0" : "1"} />
                      <SubmitButton variant="secondary" className="btn-sm">
                        {m.isResolved ? "Reopen" : "Mark resolved"}
                      </SubmitButton>
                    </BoundForm>
                  </div>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm">{m.message}</p>
              </li>
            );
          })}
        </ul>
      ) : (
        <Empty>No messages yet.</Empty>
      )}
    </>
  );
}

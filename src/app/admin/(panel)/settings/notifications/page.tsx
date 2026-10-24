import type { Metadata } from "next";
import { desc } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { notifications } from "@/server/db/schema";
import { getEnv } from "@/server/env";
import { emailConfigured } from "@/server/notify";
import { getSettings } from "@/server/services/settings";
import { formatDateTime } from "@/lib/dates";
import { AdminForm, Checkbox, SubmitButton } from "@/components/admin/form";
import { SettingsTabs } from "@/components/admin/settings-tabs";
import { Badge, Empty, PageHeader, Panel, Table } from "@/components/admin/ui";
import { saveNotificationSettingsAction } from "../../../_actions/content";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationSettings() {
  const db = getDb();
  const [n, log] = await Promise.all([getSettings(db, "notifications"), db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(50)]);
  const env = getEnv();
  const configured = emailConfigured(env);
  return (
    <>
      <PageHeader title="Settings" />
      <SettingsTabs active="/admin/settings/notifications" />
      <Panel title="Delivery channels" className="mb-5">
        <ul className="space-y-2 text-sm">
          <li>
            Email: {configured ? <Badge tone="good">SMTP configured ({env.SMTP_HOST})</Badge> : <Badge tone="bad">Not configured</Badge>} {configured ? null : "Emails are recorded below but not sent. Set EMAIL_DRIVER=smtp and the SMTP variables."}
          </li>
          <li>
            WhatsApp messages: <Badge>Not integrated</Badge> Use the WhatsApp buttons on orders and enquiries to message customers from your phone. Automatic WhatsApp updates need a WhatsApp Business API provider (see docs/environment-variables.md).
          </li>
          <li>
            SMS: <Badge>Not integrated</Badge>
          </li>
        </ul>
      </Panel>
      <AdminForm action={saveNotificationSettingsAction} className="mb-5">
        <Panel title="Emails">
          <div className="space-y-3">
            <Checkbox name="emailOwnerOnNewOrder" label="Email me about new orders" defaultChecked={n.emailOwnerOnNewOrder} hint="Sent to the alert address in Business settings." />
            <Checkbox name="emailOwnerOnBulkEnquiry" label="Email me about new bulk enquiries" defaultChecked={n.emailOwnerOnBulkEnquiry} />
            <Checkbox name="emailCustomers" label="Email customers about their orders and enquiries" defaultChecked={n.emailCustomers} hint="Only to customers who gave an email address." />
            <SubmitButton>Save</SubmitButton>
          </div>
        </Panel>
      </AdminForm>
      <Panel title="Recent emails">
        {log.length ? (
          <Table className="border-0">
            <thead>
              <tr>
                <th>When</th>
                <th>To</th>
                <th>Subject</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {log.map((m) => (
                <tr key={m.id}>
                  <td className="whitespace-nowrap text-xs">{formatDateTime(m.createdAt)}</td>
                  <td className="text-xs">{m.recipient}</td>
                  <td className="text-sm">
                    {m.subject}
                    {m.error ? <span className="block text-xs text-danger">{m.error}</span> : null}
                  </td>
                  <td>
                    <Badge tone={m.status === "sent" ? "good" : m.status === "failed" ? "bad" : "neutral"}>{m.status === "not_configured" ? "not sent" : m.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        ) : (
          <Empty>No emails yet.</Empty>
        )}
      </Panel>
    </>
  );
}

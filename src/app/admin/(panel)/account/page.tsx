import type { Metadata } from "next";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { adminSessions } from "@/server/db/schema";
import { requireAdmin } from "@/server/auth/session";
import { formatDateTime } from "@/lib/dates";
import { AdminForm, SubmitButton, TextInput } from "@/components/admin/form";
import { Badge, PageHeader, Panel } from "@/components/admin/ui";
import { changePasswordAction, signOutOthersAction } from "../../_actions/account";

export const metadata: Metadata = { title: "Account" };

export default async function AccountPage() {
  const { admin, sessionId } = await requireAdmin();
  const sessions = await getDb()
    .select()
    .from(adminSessions)
    .where(and(eq(adminSessions.adminId, admin.id), isNull(adminSessions.revokedAt), gt(adminSessions.expiresAt, new Date())))
    .orderBy(desc(adminSessions.lastSeenAt))
    .limit(20);
  return (
    <>
      <PageHeader title="Account" description={`Signed in as ${admin.name} (${admin.email}). There is one administrator account for this website.`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Change password">
          <AdminForm action={changePasswordAction} className="space-y-3" resetOnSuccess>
            <TextInput name="current" label="Current password" type="password" autoComplete="current-password" />
            <TextInput name="password" label="New password" type="password" autoComplete="new-password" hint="At least 12 characters. Changing it signs out your other devices." />
            <TextInput name="confirm" label="Repeat new password" type="password" autoComplete="new-password" />
            <SubmitButton>Change password</SubmitButton>
          </AdminForm>
        </Panel>
        <Panel title="Where you are signed in">
          <ul className="mb-4 divide-y divide-line text-sm">
            {sessions.map((s) => (
              <li key={s.id} className="py-2">
                <p className="truncate">{s.userAgent ?? "Unknown device"}</p>
                <p className="text-xs text-muted">
                  Last active {formatDateTime(s.lastSeenAt)} {s.id === sessionId ? <Badge tone="good">this device</Badge> : null}
                </p>
              </li>
            ))}
          </ul>
          <AdminForm action={signOutOthersAction}>
            <SubmitButton variant="secondary">Sign out all other devices</SubmitButton>
          </AdminForm>
        </Panel>
      </div>
    </>
  );
}

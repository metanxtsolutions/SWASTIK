import { sql } from "drizzle-orm";
import { LogOut } from "lucide-react";
import { getDb } from "@/server/db/client";
import { requireAdmin } from "@/server/auth/session";
import { getEnv, isNonProduction } from "@/server/env";
import { AdminNav } from "@/components/admin/nav";
import { logoutAction } from "../_actions/auth";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const { admin } = await requireAdmin();
  const db = getDb();
  const r = await db.execute<{ orders: number; enquiries: number; messages: number }>(sql`
    SELECT (SELECT count(*)::int FROM orders WHERE status = 'pending_confirmation') AS orders,
           (SELECT count(*)::int FROM bulk_enquiries WHERE status = 'new') AS enquiries,
           (SELECT count(*)::int FROM contact_messages WHERE NOT is_resolved) AS messages`);
  const badges = r.rows[0] ?? { orders: 0, enquiries: 0, messages: 0 };
  const env = getEnv();
  return (
    <div className="lg:flex">
      <AdminNav
        badges={{ orders: Number(badges.orders), enquiries: Number(badges.enquiries), messages: Number(badges.messages) }}
        logout={
          <form action={logoutAction}>
            <p className="mb-2 truncate px-3 text-xs text-muted">Signed in as {admin.email}</p>
            <button type="submit" className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-ink-soft hover:bg-sand">
              <LogOut aria-hidden className="h-4.5 w-4.5" />
              Sign out
            </button>
          </form>
        }
      />
      <div className="min-w-0 flex-1">
        {isNonProduction(env) ? <p className="bg-info px-4 py-1.5 text-center text-xs font-medium text-white">{env.APP_STAGE === "preview" ? "Preview" : "Development"} site: test payments only.</p> : null}
        <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
      </div>
    </div>
  );
}

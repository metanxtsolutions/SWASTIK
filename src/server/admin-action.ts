import "server-only";
import { revalidatePath } from "next/cache";
import { ZodError } from "zod";
import { getDb, type Database } from "./db/client";
import { audit } from "./audit";
import { clientIp, requireAdmin } from "./auth/session";
import { AppError } from "./errors";
import type { ActionState } from "./admin-action-types";

export interface AdminContext {
  db: Database;
  actor: string;
  adminId: string;
  sessionId: string;
  ip: string | null;
  audit: (action: string, entityType: string, entityId?: string | null, details?: Record<string, unknown>) => Promise<void>;
}

/**
 * Runs an admin mutation. The session is checked on the server for every call
 * (server actions are public HTTP endpoints, so the layout's check is not enough).
 * Public pages are revalidated afterwards so changes appear on the storefront.
 */
export async function adminAction(fn: (ctx: AdminContext) => Promise<string | void>, opts: { revalidate?: boolean } = {}): Promise<ActionState> {
  const session = await requireAdmin();
  const db = getDb();
  const ip = await clientIp();
  const ctx: AdminContext = {
    db,
    actor: session.actor,
    adminId: session.admin.id,
    sessionId: session.sessionId,
    ip,
    audit: (action, entityType, entityId, details) => audit(db, { actor: session.actor, action, entityType, entityId, details, ip }),
  };
  try {
    const message = await fn(ctx);
    if (opts.revalidate !== false) revalidatePath("/", "layout");
    return { ok: true, message: message || "Saved." };
  } catch (e) {
    if (e instanceof AppError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
    if (e instanceof ZodError) return { ok: false, error: e.issues[0]?.message ?? "Invalid input" };
    console.error(JSON.stringify({ level: "error", msg: "admin_action_failed", error: e instanceof Error ? `${e.name}: ${e.message}` : String(e), stack: e instanceof Error ? e.stack : undefined }));
    return { ok: false, error: "Something went wrong while saving. Please try again." };
  }
}

export const fd = {
  str(f: FormData, k: string): string {
    const v = f.get(k);
    return typeof v === "string" ? v : "";
  },
  bool(f: FormData, k: string): boolean {
    const v = f.get(k);
    return v === "on" || v === "true" || v === "1";
  },
  all(f: FormData, k: string): string[] {
    return f.getAll(k).filter((v): v is string => typeof v === "string" && v !== "");
  },
  file(f: FormData, k: string): File | null {
    const v = f.get(k);
    return v instanceof File && v.size > 0 ? v : null;
  },
  files(f: FormData, k: string): File[] {
    return f.getAll(k).filter((v): v is File => v instanceof File && v.size > 0);
  },
};

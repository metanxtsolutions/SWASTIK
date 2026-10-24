import type { DbOrTx } from "./db/client";
import { auditLogs } from "./db/schema";

export interface AuditEntry {
  actor: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: Record<string, unknown>;
  ip?: string | null;
}

/** Records a sensitive action. Never include passwords, tokens or full payment data in details. */
export async function audit(db: DbOrTx, entry: AuditEntry): Promise<void> {
  await db.insert(auditLogs).values({
    actor: entry.actor,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    details: entry.details ?? {},
    ip: entry.ip ?? null,
  });
}

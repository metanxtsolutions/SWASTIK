import { and, eq, gt, isNull, ne, sql } from "drizzle-orm";
import { z } from "zod";
import type { Database, DbOrTx } from "../db/client";
import { adminSessions, adminUsers, passwordResetTokens } from "../db/schema";
import { audit } from "../audit";
import { DUMMY_PASSWORD_HASH, hashIp, hashPassword, hashToken, randomToken, verifyPassword } from "../crypto";
import { getEnv } from "../env";
import { AppError, ConflictError, ValidationError } from "../errors";
import { emailConfigured, sendEmail } from "../notify";
import { rateLimit } from "../rate-limit";

/**
 * The single master administrator. There is no public registration: the account
 * is created once with `npm run admin:create` or the one-time /admin/setup page
 * (which needs ADMIN_SETUP_TOKEN and only works while no administrator exists).
 */

export const SESSION_TTL_HOURS = 24 * 7;
export const SESSION_IDLE_HOURS = 48;
const RESET_TTL_MINUTES = 30;

const COMMON_PASSWORDS = new Set([
  "password",
  "password123",
  "password1234",
  "123456789012",
  "qwertyuiopas",
  "iloveyou1234",
  "swastik12345",
  "swastik@1234",
  "admin1234567",
  "administrator",
  "welcome12345",
  "letmein12345",
]);

export function passwordProblem(password: string, email?: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password.length > 200) return "Use at most 200 characters.";
  const lower = password.toLowerCase();
  if (COMMON_PASSWORDS.has(lower)) return "This password is too common.";
  if (/^(.)\1+$/.test(password)) return "Do not repeat one character.";
  if (new Set(password).size < 6) return "Use a greater variety of characters.";
  const local = email?.split("@")[0]?.toLowerCase();
  if (local && local.length >= 4 && lower.includes(local)) return "Do not include your email name in the password.";
  if (lower.includes("swastik") && password.length < 16) return "Avoid the business name unless the password is 16 characters or longer.";
  return null;
}

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(120),
  name: z.string().trim().min(2, "Enter a name").max(80),
  password: z.string(),
});

export async function adminExists(db: DbOrTx): Promise<boolean> {
  const [row] = await db.select({ id: adminUsers.id }).from(adminUsers).limit(1);
  return !!row;
}

export async function createAdmin(db: DbOrTx, raw: { email: string; name: string; password: string }, actor = "setup") {
  const input = credentialsSchema.parse(raw);
  const problem = passwordProblem(input.password, input.email);
  if (problem) throw new ValidationError(problem, { password: problem });
  if (await adminExists(db)) throw new ConflictError("An administrator account already exists.");
  try {
    const [admin] = await db.insert(adminUsers).values({ email: input.email, name: input.name, passwordHash: await hashPassword(input.password) }).returning();
    await audit(db, { actor, action: "admin.created", entityType: "admin", entityId: admin.id, details: { email: admin.email } });
    return admin;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw new ConflictError("An administrator account already exists.");
    throw e;
  }
}

export interface LoginContext {
  ip: string | null;
  userAgent: string | null;
}

export async function login(db: Database, email: string, password: string, ctx: LoginContext): Promise<{ token: string; adminId: string }> {
  const normalized = email.trim().toLowerCase();
  await rateLimit(db, `login:ip:${hashIp(ctx.ip)}`, 10, 15 * 60, "Too many sign-in attempts. Please wait 15 minutes and try again.");
  await rateLimit(db, `login:email:${normalized}`, 5, 15 * 60, "Too many sign-in attempts. Please wait 15 minutes and try again.");
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, normalized)).limit(1);
  // Always run one password hash so response time does not reveal whether the email exists.
  const ok = await verifyPassword(password, admin?.passwordHash ?? DUMMY_PASSWORD_HASH);
  if (!admin || !ok) {
    await audit(db, { actor: "anonymous", action: "admin.login_failed", entityType: "admin", details: { email: normalized.slice(0, 120) }, ip: ctx.ip });
    throw new AppError("The email or password is incorrect.");
  }
  const token = randomToken();
  const now = new Date();
  await db.insert(adminSessions).values({
    adminId: admin.id,
    tokenHash: hashToken(token),
    ip: ctx.ip,
    userAgent: ctx.userAgent?.slice(0, 300) ?? null,
    expiresAt: new Date(now.getTime() + SESSION_TTL_HOURS * 3600_000),
  });
  await db.update(adminUsers).set({ lastLoginAt: now }).where(eq(adminUsers.id, admin.id));
  await audit(db, { actor: `admin:${admin.email}`, action: "admin.login", entityType: "admin", entityId: admin.id, ip: ctx.ip });
  return { token, adminId: admin.id };
}

export async function sessionFromToken(db: DbOrTx, token: string | undefined | null) {
  if (!token || token.length < 20 || token.length > 100) return null;
  const now = new Date();
  const [row] = await db
    .select({ session: adminSessions, admin: adminUsers })
    .from(adminSessions)
    .innerJoin(adminUsers, eq(adminUsers.id, adminSessions.adminId))
    .where(and(eq(adminSessions.tokenHash, hashToken(token)), isNull(adminSessions.revokedAt), gt(adminSessions.expiresAt, now)))
    .limit(1);
  if (!row) return null;
  if (now.getTime() - row.session.lastSeenAt.getTime() > SESSION_IDLE_HOURS * 3600_000) return null;
  // A password change ends every session started before it.
  if (row.session.createdAt < row.admin.passwordChangedAt) return null;
  if (now.getTime() - row.session.lastSeenAt.getTime() > 5 * 60_000) {
    await db.update(adminSessions).set({ lastSeenAt: now }).where(eq(adminSessions.id, row.session.id));
  }
  return { sessionId: row.session.id, admin: { id: row.admin.id, email: row.admin.email, name: row.admin.name } };
}

export async function logout(db: DbOrTx, token: string | undefined): Promise<void> {
  if (!token) return;
  await db.update(adminSessions).set({ revokedAt: new Date() }).where(eq(adminSessions.tokenHash, hashToken(token)));
}

export async function revokeSessions(db: DbOrTx, adminId: string, exceptSessionId?: string): Promise<number> {
  const rows = await db
    .update(adminSessions)
    .set({ revokedAt: new Date() })
    .where(and(eq(adminSessions.adminId, adminId), isNull(adminSessions.revokedAt), exceptSessionId ? ne(adminSessions.id, exceptSessionId) : undefined))
    .returning({ id: adminSessions.id });
  return rows.length;
}

export async function changePassword(db: Database, adminId: string, sessionId: string, current: string, next: string, ip: string | null): Promise<void> {
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.id, adminId));
  if (!admin) throw new AppError("Account not found.");
  await rateLimit(db, `password-change:${adminId}`, 5, 15 * 60);
  if (!(await verifyPassword(current, admin.passwordHash))) throw new ValidationError("The current password is incorrect.", { current: "Incorrect" });
  const problem = passwordProblem(next, admin.email);
  if (problem) throw new ValidationError(problem, { password: problem });
  if (await verifyPassword(next, admin.passwordHash)) throw new ValidationError("Choose a password you have not used here before.", { password: "Same as current" });
  const now = new Date();
  await db.transaction(async (tx) => {
    // passwordChangedAt invalidates older sessions; keep the current one by moving its start forward.
    await tx.update(adminUsers).set({ passwordHash: await hashPassword(next), passwordChangedAt: now, updatedAt: now }).where(eq(adminUsers.id, adminId));
    await revokeSessions(tx, adminId, sessionId);
    await tx.update(adminSessions).set({ createdAt: new Date(now.getTime() + 1) }).where(eq(adminSessions.id, sessionId));
    await audit(tx, { actor: `admin:${admin.email}`, action: "admin.password_changed", entityType: "admin", entityId: adminId, ip });
  });
}

/** Always resolves the same way, whether or not the email matches, so the account email is not revealed. */
export async function requestPasswordReset(db: Database, email: string, ip: string | null): Promise<{ emailDelivery: boolean }> {
  const normalized = email.trim().toLowerCase();
  await rateLimit(db, `reset:ip:${hashIp(ip)}`, 5, 60 * 60);
  await rateLimit(db, `reset:email:${normalized}`, 3, 60 * 60);
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, normalized)).limit(1);
  if (admin) {
    const token = randomToken();
    await db.insert(passwordResetTokens).values({ adminId: admin.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MINUTES * 60_000) });
    await sendEmail(db, {
      to: admin.email,
      subject: "Reset your Swastik admin password",
      body: `A password reset was requested for the Swastik admin panel.\n\nReset your password within ${RESET_TTL_MINUTES} minutes:\n${getEnv().APP_URL}/admin/reset-password?token=${token}\n\nIf you did not ask for this, ignore this email. Your password stays the same.`,
      template: "admin_password_reset",
    });
    await audit(db, { actor: "anonymous", action: "admin.password_reset_requested", entityType: "admin", entityId: admin.id, ip });
  }
  return { emailDelivery: emailConfigured() };
}

export async function resetPassword(db: Database, token: string, next: string, ip: string | null): Promise<void> {
  await rateLimit(db, `reset-use:ip:${hashIp(ip)}`, 10, 60 * 60);
  const now = new Date();
  const [row] = await db
    .select({ t: passwordResetTokens, admin: adminUsers })
    .from(passwordResetTokens)
    .innerJoin(adminUsers, eq(adminUsers.id, passwordResetTokens.adminId))
    .where(and(eq(passwordResetTokens.tokenHash, hashToken(token)), isNull(passwordResetTokens.usedAt), gt(passwordResetTokens.expiresAt, now)))
    .limit(1);
  if (!row) throw new AppError("This reset link is invalid or has expired. Request a new one.");
  const problem = passwordProblem(next, row.admin.email);
  if (problem) throw new ValidationError(problem, { password: problem });
  await db.transaction(async (tx) => {
    await tx.update(passwordResetTokens).set({ usedAt: now }).where(eq(passwordResetTokens.adminId, row.admin.id));
    await tx.update(adminUsers).set({ passwordHash: await hashPassword(next), passwordChangedAt: now, updatedAt: now }).where(eq(adminUsers.id, row.admin.id));
    await revokeSessions(tx, row.admin.id);
    await audit(tx, { actor: `admin:${row.admin.email}`, action: "admin.password_reset", entityType: "admin", entityId: row.admin.id, ip });
  });
}

/** Used by the command-line recovery script when email is not available. */
export async function setPasswordDirectly(db: Database, email: string, next: string): Promise<void> {
  const [admin] = await db.select().from(adminUsers).where(eq(adminUsers.email, email.trim().toLowerCase())).limit(1);
  if (!admin) throw new AppError("No administrator with that email.");
  const problem = passwordProblem(next, admin.email);
  if (problem) throw new ValidationError(problem);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(adminUsers).set({ passwordHash: await hashPassword(next), passwordChangedAt: now, updatedAt: now }).where(eq(adminUsers.id, admin.id));
    await revokeSessions(tx, admin.id);
    await audit(tx, { actor: "cli", action: "admin.password_reset_cli", entityType: "admin", entityId: admin.id });
  });
}

export async function pruneSessions(db: DbOrTx): Promise<void> {
  await db.execute(sql`DELETE FROM admin_sessions WHERE expires_at < now() - interval '7 days' OR revoked_at < now() - interval '7 days'`);
  await db.execute(sql`DELETE FROM password_reset_tokens WHERE expires_at < now() - interval '1 day'`);
}

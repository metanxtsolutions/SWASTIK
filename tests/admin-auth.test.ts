import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { adminSessions, notifications } from "@/server/db/schema";
import { hashToken } from "@/server/crypto";
import { RateLimitError } from "@/server/errors";
import { changePassword, createAdmin, login, logout, passwordProblem, requestPasswordReset, resetPassword, revokeSessions, sessionFromToken } from "@/server/services/admin-auth";
import { db } from "./helpers";

const PASSWORD = "lotus and marigold at dawn";
const ctx = { ip: "203.0.113.5", userAgent: "vitest" };

describe("master administrator", () => {
  it("allows exactly one administrator account", async () => {
    await createAdmin(db(), { email: "Owner@Example.com", name: "Owner", password: PASSWORD });
    await expect(createAdmin(db(), { email: "second@example.com", name: "Second", password: PASSWORD })).rejects.toThrow(/already exists/);
  });

  it("rejects weak passwords", () => {
    expect(passwordProblem("short")).toMatch(/12 characters/);
    expect(passwordProblem("password1234")).toMatch(/common/);
    expect(passwordProblem("aaaaaaaaaaaaaa")).toBeTruthy();
    expect(passwordProblem("owner-is-me-123456", "owner@example.com")).toMatch(/email/);
    expect(passwordProblem(PASSWORD)).toBeNull();
  });

  it("signs in with the right password, stores only a hash of the session token, and signs out", async () => {
    await createAdmin(db(), { email: "owner@example.com", name: "Owner", password: PASSWORD });
    await expect(login(db(), "owner@example.com", "not the password", ctx)).rejects.toThrow(/incorrect/);
    await expect(login(db(), "nobody@example.com", PASSWORD, ctx)).rejects.toThrow(/incorrect/);
    const { token } = await login(db(), "OWNER@example.com", PASSWORD, ctx);
    const rows = await db().select().from(adminSessions);
    expect(rows).toHaveLength(1);
    expect(rows[0].tokenHash).toBe(hashToken(token));
    expect(rows[0].tokenHash).not.toContain(token);
    expect((await sessionFromToken(db(), token))?.admin.email).toBe("owner@example.com");
    expect(await sessionFromToken(db(), "forged-token-forged-token-forged")).toBeNull();
    await logout(db(), token);
    expect(await sessionFromToken(db(), token)).toBeNull();
  });

  it("rate limits repeated sign-in attempts", async () => {
    await createAdmin(db(), { email: "owner@example.com", name: "Owner", password: PASSWORD });
    for (let i = 0; i < 5; i++) await expect(login(db(), "owner@example.com", "wrong", ctx)).rejects.toThrow(/incorrect/);
    await expect(login(db(), "owner@example.com", PASSWORD, ctx)).rejects.toBeInstanceOf(RateLimitError);
  });

  it("expires idle and old sessions", async () => {
    await createAdmin(db(), { email: "owner@example.com", name: "Owner", password: PASSWORD });
    const { token } = await login(db(), "owner@example.com", PASSWORD, ctx);
    await db().update(adminSessions).set({ lastSeenAt: new Date(Date.now() - 49 * 3600_000) });
    expect(await sessionFromToken(db(), token)).toBeNull();
    await db().update(adminSessions).set({ lastSeenAt: new Date(), expiresAt: new Date(Date.now() - 1000) });
    expect(await sessionFromToken(db(), token)).toBeNull();
  });

  it("signs out other devices when the password changes", async () => {
    const admin = await createAdmin(db(), { email: "owner@example.com", name: "Owner", password: PASSWORD });
    const a = await login(db(), "owner@example.com", PASSWORD, ctx);
    const b = await login(db(), "owner@example.com", PASSWORD, { ...ctx, userAgent: "phone" });
    const sa = await sessionFromToken(db(), a.token);
    await changePassword(db(), admin.id, sa!.sessionId, PASSWORD, "new garland for the mandir", null);
    expect(await sessionFromToken(db(), a.token)).not.toBeNull();
    expect(await sessionFromToken(db(), b.token)).toBeNull();
    await expect(login(db(), "owner@example.com", PASSWORD, { ...ctx, ip: "198.51.100.1" })).rejects.toThrow(/incorrect/);
    expect(await revokeSessions(db(), admin.id)).toBe(1);
  });

  it("resets the password with a one-time emailed link", async () => {
    await createAdmin(db(), { email: "owner@example.com", name: "Owner", password: PASSWORD });
    const old = await login(db(), "owner@example.com", PASSWORD, ctx);
    await requestPasswordReset(db(), "owner@example.com", ctx.ip);
    await requestPasswordReset(db(), "stranger@example.com", ctx.ip);
    const sent = await db().select().from(notifications).where(eq(notifications.template, "admin_password_reset"));
    expect(sent).toHaveLength(1);
    const token = sent[0].body.match(/token=([\w-]+)/)![1];
    await resetPassword(db(), token, "brand new puja password", ctx.ip);
    await expect(resetPassword(db(), token, "another new puja password", ctx.ip)).rejects.toThrow(/invalid or has expired/);
    expect(await sessionFromToken(db(), old.token)).toBeNull();
    await expect(login(db(), "owner@example.com", "brand new puja password", { ...ctx, ip: "198.51.100.2" })).resolves.toBeTruthy();
  });
});

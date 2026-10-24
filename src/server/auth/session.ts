import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db/client";
import { getEnv } from "../env";
import { sessionFromToken, SESSION_TTL_HOURS } from "../services/admin-auth";

// The __Host- prefix makes browsers refuse the cookie unless it is Secure, host-only and path=/.
export function sessionCookieName(): string {
  return getEnv().APP_URL.startsWith("https://") ? "__Host-swastik_admin" : "swastik_admin";
}

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent");
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(sessionCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: getEnv().APP_URL.startsWith("https://"),
    path: "/",
    maxAge: SESSION_TTL_HOURS * 3600,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(sessionCookieName());
}

export async function sessionToken(): Promise<string | undefined> {
  return (await cookies()).get(sessionCookieName())?.value;
}

/** The signed-in administrator for this request, or null. Checked against the database every time. */
export const currentAdmin = cache(async () => sessionFromToken(getDb(), await sessionToken()));

export async function requireAdmin() {
  const s = await currentAdmin();
  if (!s) redirect("/admin/login");
  return { ...s, actor: `admin:${s.admin.email}` };
}

"use server";

import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { AppError } from "@/server/errors";
import { safeEqual } from "@/server/crypto";
import { clearSessionCookie, clientIp, setSessionCookie, sessionToken, userAgent } from "@/server/auth/session";
import { adminExists, createAdmin, login, logout, requestPasswordReset, resetPassword } from "@/server/services/admin-auth";
import type { ActionState } from "@/server/admin-action-types";
import { fd } from "@/server/admin-action";

function failure(e: unknown): ActionState {
  if (e instanceof AppError) return { ok: false, error: e.message, fieldErrors: e.fieldErrors };
  console.error(e);
  return { ok: false, error: "Something went wrong. Please try again." };
}

export async function loginAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { token } = await login(getDb(), fd.str(form, "email"), fd.str(form, "password"), { ip: await clientIp(), userAgent: await userAgent() });
    await setSessionCookie(token);
  } catch (e) {
    return failure(e);
  }
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await logout(getDb(), await sessionToken());
  await clearSessionCookie();
  redirect("/admin/login");
}

export async function setupAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const db = getDb();
    const expected = getEnv().ADMIN_SETUP_TOKEN;
    if (!expected) throw new AppError("Online setup is turned off. Set ADMIN_SETUP_TOKEN, or create the account with npm run admin:create.");
    if (await adminExists(db)) throw new AppError("The administrator account already exists. Sign in instead.");
    if (!safeEqual(fd.str(form, "setupToken"), expected)) throw new AppError("The setup token is not correct.", { setupToken: "Incorrect" });
    if (fd.str(form, "password") !== fd.str(form, "confirm")) throw new AppError("The passwords do not match.", { confirm: "Does not match" });
    await createAdmin(db, { email: fd.str(form, "email"), name: fd.str(form, "name"), password: fd.str(form, "password") }, "setup_page");
    const { token } = await login(db, fd.str(form, "email"), fd.str(form, "password"), { ip: await clientIp(), userAgent: await userAgent() });
    await setSessionCookie(token);
  } catch (e) {
    return failure(e);
  }
  redirect("/admin");
}

export async function forgotPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    const { emailDelivery } = await requestPasswordReset(getDb(), fd.str(form, "email"), await clientIp());
    return {
      ok: true,
      message: emailDelivery
        ? "If that is the administrator email, a reset link is on its way. It works for 30 minutes."
        : "Email delivery is not configured on this site, so no reset email can be sent. Use npm run admin:reset-password on the server instead (see docs/admin-guide.md).",
    };
  } catch (e) {
    return failure(e);
  }
}

export async function resetPasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  try {
    if (fd.str(form, "password") !== fd.str(form, "confirm")) throw new AppError("The passwords do not match.", { confirm: "Does not match" });
    await resetPassword(getDb(), fd.str(form, "token"), fd.str(form, "password"), await clientIp());
    return { ok: true, message: "Your password has been changed and every session was signed out. You can sign in now." };
  } catch (e) {
    return failure(e);
  }
}

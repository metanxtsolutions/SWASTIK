"use server";

import { adminAction, fd } from "@/server/admin-action";
import type { ActionState } from "@/server/admin-action-types";
import { ValidationError } from "@/server/errors";
import { changePassword, revokeSessions } from "@/server/services/admin-auth";

export async function changePasswordAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    if (fd.str(form, "password") !== fd.str(form, "confirm")) throw new ValidationError("The new passwords do not match.", { confirm: "Does not match" });
    await changePassword(ctx.db, ctx.adminId, ctx.sessionId, fd.str(form, "current"), fd.str(form, "password"), ctx.ip);
    return "Password changed. Other devices have been signed out.";
  }, { revalidate: false });
}

export async function signOutOthersAction(_prev: ActionState): Promise<ActionState> {
  return adminAction(async (ctx) => {
    const n = await revokeSessions(ctx.db, ctx.adminId, ctx.sessionId);
    await ctx.audit("admin.sessions_revoked", "admin", ctx.adminId, { count: n });
    return n ? `Signed out ${n} other session${n === 1 ? "" : "s"}.` : "No other sessions were signed in.";
  }, { revalidate: false });
}

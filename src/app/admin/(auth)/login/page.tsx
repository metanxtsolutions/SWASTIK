import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { currentAdmin } from "@/server/auth/session";
import { adminExists } from "@/server/services/admin-auth";
import { AdminForm, SubmitButton, TextInput } from "@/components/admin/form";
import { loginAction } from "../../_actions/auth";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await currentAdmin()) redirect("/admin");
  const exists = await adminExists(getDb());
  if (!exists) {
    return (
      <div className="space-y-3">
        <h1 className="text-2xl font-semibold">No administrator yet</h1>
        <p className="text-ink-soft">Create the master administrator account first. Run this on a machine with access to the database:</p>
        <pre className="overflow-x-auto rounded-xl bg-ink p-3 text-sm text-white">npm run admin:create</pre>
        {getEnv().ADMIN_SETUP_TOKEN ? (
          <p className="text-sm">
            Or use the one-time <Link href="/admin/setup" className="font-semibold text-saffron-dark underline">online setup</Link> with your setup token.
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Sign in</h1>
      <p className="mb-5 text-sm text-muted">Swastik administration</p>
      <AdminForm action={loginAction} className="space-y-4">
        <TextInput name="email" label="Email" type="email" autoComplete="username" required />
        <TextInput name="password" label="Password" type="password" autoComplete="current-password" required />
        <SubmitButton className="w-full">Sign in</SubmitButton>
      </AdminForm>
      <p className="mt-4 text-center text-sm">
        <Link href="/admin/forgot-password" className="text-saffron-dark underline">
          Forgot your password?
        </Link>
      </p>
    </>
  );
}

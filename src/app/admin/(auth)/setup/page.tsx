import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { adminExists } from "@/server/services/admin-auth";
import { AdminForm, SubmitButton, TextInput } from "@/components/admin/form";
import { setupAction } from "../../_actions/auth";

export const metadata: Metadata = { title: "Set up the administrator" };
export const dynamic = "force-dynamic";

/** One-time setup: only while no administrator exists and ADMIN_SETUP_TOKEN is set. */
export default async function SetupPage() {
  if (!getEnv().ADMIN_SETUP_TOKEN || (await adminExists(getDb()))) notFound();
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Create the administrator</h1>
      <p className="mb-5 text-sm text-muted">This page works once. Afterwards, remove ADMIN_SETUP_TOKEN from the environment.</p>
      <AdminForm action={setupAction} className="space-y-4">
        <TextInput name="setupToken" label="Setup token" type="password" autoComplete="off" required hint="The value of ADMIN_SETUP_TOKEN." />
        <TextInput name="name" label="Your name" autoComplete="name" required />
        <TextInput name="email" label="Email" type="email" autoComplete="username" required />
        <TextInput name="password" label="Password" type="password" autoComplete="new-password" required hint="At least 12 characters. A short sentence is easy to remember and hard to guess." />
        <TextInput name="confirm" label="Repeat password" type="password" autoComplete="new-password" required />
        <SubmitButton className="w-full">Create account</SubmitButton>
      </AdminForm>
    </>
  );
}

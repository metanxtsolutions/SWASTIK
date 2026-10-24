import type { Metadata } from "next";
import Link from "next/link";
import { AdminForm, SubmitButton, TextInput } from "@/components/admin/form";
import { resetPasswordAction } from "../../_actions/auth";

export const metadata: Metadata = { title: "Choose a new password", referrer: "no-referrer" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="mb-5 text-2xl font-semibold">Choose a new password</h1>
      <AdminForm action={resetPasswordAction} className="space-y-4">
        <input type="hidden" name="token" value={token ?? ""} />
        <TextInput name="password" label="New password" type="password" autoComplete="new-password" required hint="At least 12 characters." />
        <TextInput name="confirm" label="Repeat new password" type="password" autoComplete="new-password" required />
        <SubmitButton className="w-full">Change password</SubmitButton>
      </AdminForm>
      <p className="mt-4 text-center text-sm">
        <Link href="/admin/login" className="text-saffron-dark underline">
          Sign in
        </Link>
      </p>
    </>
  );
}

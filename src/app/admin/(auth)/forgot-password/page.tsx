import type { Metadata } from "next";
import Link from "next/link";
import { AdminForm, SubmitButton, TextInput } from "@/components/admin/form";
import { forgotPasswordAction } from "../../_actions/auth";

export const metadata: Metadata = { title: "Reset password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold">Reset your password</h1>
      <p className="mb-5 text-sm text-muted">We will email a reset link to the administrator address.</p>
      <AdminForm action={forgotPasswordAction} className="space-y-4">
        <TextInput name="email" label="Administrator email" type="email" autoComplete="username" required />
        <SubmitButton className="w-full">Send reset link</SubmitButton>
      </AdminForm>
      <p className="mt-4 text-center text-sm">
        <Link href="/admin/login" className="text-saffron-dark underline">
          Back to sign in
        </Link>
      </p>
    </>
  );
}

import { Logo } from "@/components/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="mb-6">
        <Logo />
      </div>
      <div className="card w-full max-w-md p-6 sm:p-8">{children}</div>
    </main>
  );
}

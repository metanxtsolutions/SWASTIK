import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Swastik admin", template: "%s | Swastik admin" },
  robots: { index: false, follow: false },
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#f7f3ee]">{children}</div>;
}

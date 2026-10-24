import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "./globals.css";
import { getEnv } from "@/server/env";

export const metadata: Metadata = {
  metadataBase: new URL(getEnv().APP_URL),
  applicationName: "Swastik",
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#fff9f1",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-IN">
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}

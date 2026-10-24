import type { Metadata } from "next";
import { TrackForm } from "@/components/shop/track-form";

export const metadata: Metadata = { title: "Track your order", robots: { index: false, follow: true } };

export default async function TrackPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const { order } = await searchParams;
  return (
    <div className="container-page max-w-3xl py-8">
      <h1 className="text-3xl font-semibold">Track your order</h1>
      <p className="mb-5 mt-1 text-ink-soft">Enter your order number and the mobile number you used at checkout.</p>
      <TrackForm initialOrder={(order ?? "").slice(0, 20)} />
    </div>
  );
}

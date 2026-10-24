import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FlaskConical } from "lucide-react";
import { getDb } from "@/server/db/client";
import { mockGateway } from "@/server/payments";
import { getOrderByAccess } from "@/server/services/orders";
import { startPayment } from "@/server/services/payments";
import { formatINR } from "@/lib/money";
import { SimulatePayment } from "@/components/shop/order-actions";

export const metadata: Metadata = { title: "Test payment", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Test-mode payment page. It does not exist when APP_STAGE=production. */
export default async function TestPaymentPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<{ t?: string }> }) {
  if (!mockGateway()) notFound();
  const { number } = await params;
  const { t } = await searchParams;
  const db = getDb();
  const found = await getOrderByAccess(db, number, t);
  if (!found || found.order.status !== "pending_payment") notFound();
  await startPayment(db, number, t!);
  return (
    <div className="container-page max-w-lg py-10">
      <div className="card space-y-5 p-6">
        <p className="chip bg-info-soft text-info">
          <FlaskConical aria-hidden className="h-3.5 w-3.5" />
          Test mode: no real money moves
        </p>
        <h1 className="text-2xl font-semibold">Test payment for order {number}</h1>
        <p className="text-ink-soft">
          Amount <span className="font-bold text-ink">{formatINR(found.order.totalPaise)}</span>. This page stands in for the payment provider until live payment keys are configured. Each button sends a signed test webhook through the same checks a real payment uses.
        </p>
        <SimulatePayment orderNumber={number} token={t!} />
      </div>
    </div>
  );
}

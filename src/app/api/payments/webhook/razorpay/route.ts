import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { handleWebhook } from "@/server/services/payments";

export const dynamic = "force-dynamic";

/** Razorpay webhook. Configure it in the Razorpay dashboard with RAZORPAY_WEBHOOK_SECRET. */
export async function POST(req: Request) {
  if (getEnv().PAYMENT_GATEWAY !== "razorpay") return NextResponse.json({ error: "not configured" }, { status: 404 });
  const raw = await req.text();
  if (raw.length > 256 * 1024) return NextResponse.json({ error: "too large" }, { status: 413 });
  const r = await handleWebhook(getDb(), raw, req.headers);
  return NextResponse.json({ result: r.result }, { status: r.status });
}

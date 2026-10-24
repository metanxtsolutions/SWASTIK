import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { mockGateway } from "@/server/payments";
import { handleWebhook } from "@/server/services/payments";

export const dynamic = "force-dynamic";

/** Test-mode webhook (development and preview only). Signed with MOCK_WEBHOOK_SECRET. */
export async function POST(req: Request) {
  if (!mockGateway()) return NextResponse.json({ error: "not available" }, { status: 404 });
  const raw = await req.text();
  const r = await handleWebhook(getDb(), raw, req.headers);
  return NextResponse.json({ result: r.result }, { status: r.status });
}

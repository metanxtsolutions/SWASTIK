import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { errorResponse } from "@/server/http";
import { getOrderByAccess } from "@/server/services/orders";

export const dynamic = "force-dynamic";

/** Status polling for the order page while a payment is being confirmed. */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const found = await getOrderByAccess(getDb(), url.searchParams.get("number") ?? "", url.searchParams.get("t"));
    if (!found) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ status: found.order.status, paymentStatus: found.order.paymentStatus }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

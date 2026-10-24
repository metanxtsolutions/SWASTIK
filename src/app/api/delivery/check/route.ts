import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { hashIp } from "@/server/crypto";
import { errorResponse, requestIp } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { checkPincode } from "@/server/services/delivery";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const db = getDb();
    await rateLimit(db, `pin:${hashIp(requestIp(req))}`, 60, 60);
    const pincode = new URL(req.url).searchParams.get("pincode") ?? "";
    const result = await checkPincode(db, pincode);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { hashIp } from "@/server/crypto";
import { AppError } from "@/server/errors";
import { errorResponse, readJson, requestIp, sameOrigin } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { trackOrder } from "@/server/services/orders";

export const dynamic = "force-dynamic";

const schema = z.object({ orderNumber: z.string().max(20), phone: z.string().max(20) });

/** Order lookup by order number and mobile number. Rate limited so numbers cannot be guessed. */
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new AppError("Invalid request");
    const db = getDb();
    await rateLimit(db, `track:${hashIp(requestIp(req))}`, 10, 15 * 60, "Too many attempts. Please wait 15 minutes and try again.");
    const { orderNumber, phone } = schema.parse(await readJson(req));
    const result = await trackOrder(db, orderNumber, phone);
    if (!result) return NextResponse.json({ error: "We could not find an order with that order number and mobile number." }, { status: 404 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { hashIp } from "@/server/crypto";
import { AppError } from "@/server/errors";
import { errorResponse, readJson, requestIp, sameOrigin } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { startPayment } from "@/server/services/payments";

export const dynamic = "force-dynamic";

const schema = z.object({ orderNumber: z.string().max(20), token: z.string().max(64) });

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new AppError("Invalid request");
    const db = getDb();
    await rateLimit(db, `pay-start:${hashIp(requestIp(req))}`, 30, 10 * 60);
    const { orderNumber, token } = schema.parse(await readJson(req));
    return NextResponse.json(await startPayment(db, orderNumber, token));
  } catch (e) {
    return errorResponse(e);
  }
}

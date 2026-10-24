import { NextResponse } from "next/server";
import { getDb } from "@/server/db/client";
import { hashIp } from "@/server/crypto";
import { AppError } from "@/server/errors";
import { errorResponse, readJson, requestIp, sameOrigin } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { submitContact } from "@/server/services/bulk";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new AppError("Please send your message from the Swastik website.");
    const db = getDb();
    await rateLimit(db, `contact:${hashIp(requestIp(req))}`, 6, 60 * 60, "Too many messages from this connection. Please try again later.");
    await submitContact(db, await readJson(req));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}

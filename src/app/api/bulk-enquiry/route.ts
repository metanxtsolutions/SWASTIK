import { NextResponse } from "next/server";
import { after } from "next/server";
import { getDb } from "@/server/db/client";
import { hashIp } from "@/server/crypto";
import { AppError } from "@/server/errors";
import { errorResponse, readJson, requestIp, sameOrigin } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { notifyBulkEnquiry, submitBulkEnquiry } from "@/server/services/bulk";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new AppError("Please send your enquiry from the Swastik website.");
    const db = getDb();
    await rateLimit(db, `bulk:${hashIp(requestIp(req))}`, 6, 60 * 60, "Too many enquiries from this connection. Please try again later or contact us directly.");
    const created = await submitBulkEnquiry(db, await readJson(req));
    after(async () => {
      try {
        await notifyBulkEnquiry(db, created.id);
      } catch (e) {
        console.error(JSON.stringify({ level: "error", msg: "notify_failed", enquiry: created.reference, error: String(e) }));
      }
    });
    return NextResponse.json({ reference: created.reference });
  } catch (e) {
    return errorResponse(e);
  }
}

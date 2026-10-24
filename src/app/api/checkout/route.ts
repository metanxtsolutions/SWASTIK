import { NextResponse } from "next/server";
import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db/client";
import { hashIp } from "@/server/crypto";
import { AppError } from "@/server/errors";
import { errorResponse, readJson, requestIp, sameOrigin } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { notifyOrder, placeOrder } from "@/server/services/orders";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new AppError("Please place your order from the Swastik website.");
    const db = getDb();
    await rateLimit(db, `checkout:${hashIp(requestIp(req))}`, 15, 10 * 60, "Too many order attempts. Please wait a few minutes and try again.");
    const placed = await placeOrder(db, await readJson(req));
    if (!placed.replayed) {
      after(async () => {
        try {
          await notifyOrder(db, placed.orderId, "placed");
        } catch (e) {
          console.error(JSON.stringify({ level: "error", msg: "notify_failed", order: placed.orderNumber, error: String(e) }));
        }
        // Stock levels changed: refresh cached product pages.
        revalidatePath("/", "layout");
      });
    }
    return NextResponse.json({ orderNumber: placed.orderNumber, token: placed.accessToken, status: placed.status, paymentMethod: placed.paymentMethod, totalPaise: placed.totalPaise });
  } catch (e) {
    return errorResponse(e);
  }
}

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db/client";
import { getEnv } from "@/server/env";
import { safeEqual } from "@/server/crypto";
import { pruneRateLimits } from "@/server/rate-limit";
import { pruneSessions } from "@/server/services/admin-auth";
import { expireUnpaidOrders } from "@/server/services/orders";

export const dynamic = "force-dynamic";

/**
 * Daily housekeeping, called by Vercel Cron with "Authorization: Bearer CRON_SECRET".
 * Expired unpaid orders are also released whenever a new order is placed, so this
 * is a safety net rather than the only path.
 */
export async function GET(req: Request) {
  const secret = getEnv().CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const db = getDb();
  const expired = await expireUnpaidOrders(db);
  await pruneRateLimits(db);
  await pruneSessions(db);
  if (expired) revalidatePath("/", "layout");
  return NextResponse.json({ expired });
}

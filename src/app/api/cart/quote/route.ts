import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/server/db/client";
import { hashIp } from "@/server/crypto";
import { ValidationError } from "@/server/errors";
import { errorResponse, readJson, requestIp } from "@/server/http";
import { rateLimit } from "@/server/rate-limit";
import { cartLinesSchema, quoteCart } from "@/server/services/pricing";
import { normalizeIndianMobile } from "@/lib/phone";

export const dynamic = "force-dynamic";

const schema = z.object({
  lines: cartLinesSchema,
  pincode: z.string().max(10).optional().nullable(),
  couponCode: z.string().max(40).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
});

/** Prices the cart on the server. The browser never supplies prices. */
export async function POST(req: Request) {
  try {
    const db = getDb();
    await rateLimit(db, `quote:${hashIp(requestIp(req))}`, 120, 60);
    const parsed = schema.safeParse(await readJson(req));
    if (!parsed.success) throw new ValidationError("Invalid cart");
    const { lines, pincode, couponCode, phone } = parsed.data;
    const quote = await quoteCart(db, { lines, pincode, couponCode, phone: phone ? normalizeIndianMobile(phone) : null });
    return NextResponse.json(quote, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return errorResponse(e);
  }
}

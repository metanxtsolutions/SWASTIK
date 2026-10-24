import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { getDb } from "@/server/db/client";
import { AppError } from "@/server/errors";
import { errorResponse, readJson, sameOrigin } from "@/server/http";
import { confirmCheckout } from "@/server/services/payments";

export const dynamic = "force-dynamic";

const schema = z.object({
  orderNumber: z.string().max(20),
  token: z.string().max(64),
  razorpay_order_id: z.string().max(64),
  razorpay_payment_id: z.string().max(64),
  razorpay_signature: z.string().max(256),
});

/** Called by the browser after Razorpay Checkout succeeds. The signature is verified on the server. */
export async function POST(req: Request) {
  try {
    if (!sameOrigin(req)) throw new AppError("Invalid request");
    const b = schema.parse(await readJson(req));
    const r = await confirmCheckout(getDb(), { orderNumber: b.orderNumber, token: b.token, providerOrderId: b.razorpay_order_id, providerPaymentId: b.razorpay_payment_id, signature: b.razorpay_signature });
    revalidatePath("/", "layout");
    return NextResponse.json({ result: r.result });
  } catch (e) {
    return errorResponse(e);
  }
}

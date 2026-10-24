import { NextResponse } from "next/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/server/db/client";
import { payments } from "@/server/db/schema";
import { AppError, NotFoundError } from "@/server/errors";
import { errorResponse, readJson, sameOrigin } from "@/server/http";
import { mockGateway } from "@/server/payments";
import { getOrderByAccess } from "@/server/services/orders";
import { handleWebhook } from "@/server/services/payments";

export const dynamic = "force-dynamic";

const schema = z.object({ orderNumber: z.string().max(20), token: z.string().max(64), outcome: z.enum(["success", "failure"]) });

/**
 * Test-mode payment page action. Builds a webhook signed with the test secret and
 * sends it through the same verification and processing as a real gateway webhook.
 * Unavailable when APP_STAGE=production.
 */
export async function POST(req: Request) {
  try {
    const gw = mockGateway();
    if (!gw) throw new NotFoundError("Not available");
    if (!sameOrigin(req)) throw new AppError("Invalid request");
    const b = schema.parse(await readJson(req));
    const db = getDb();
    const found = await getOrderByAccess(db, b.orderNumber, b.token);
    if (!found) throw new NotFoundError("Order not found");
    const [payment] = await db
      .select()
      .from(payments)
      .where(and(eq(payments.orderId, found.order.id), eq(payments.provider, "mock")))
      .orderBy(desc(payments.createdAt))
      .limit(1);
    if (!payment?.providerOrderId) throw new AppError("Start the payment first.");
    const paymentId = `test_pay_${crypto.randomUUID().slice(0, 12)}`;
    const { body, signature } = gw.simulate(
      b.outcome === "success"
        ? { type: "payment.captured", order_id: payment.providerOrderId, payment_id: paymentId, amount: payment.amountPaise, method: "test" }
        : { type: "payment.failed", order_id: payment.providerOrderId, payment_id: paymentId, failure_reason: "Simulated failure (test mode)" },
    );
    const r = await handleWebhook(db, body, new Headers({ "x-test-signature": signature }));
    revalidatePath("/", "layout");
    return NextResponse.json({ result: r.result }, { status: r.status });
  } catch (e) {
    return errorResponse(e);
  }
}

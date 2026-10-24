"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { adminAction, fd } from "@/server/admin-action";
import type { ActionState } from "@/server/admin-action-types";
import { ValidationError } from "@/server/errors";
import { addOrderNote, notifyOrder, recordOfflinePayment, updateOrderStatus, ORDER_STATUS_LABELS, type OrderStatus, createManualOrder } from "@/server/services/orders";
import { refundOrder } from "@/server/services/payments";
import { linkEnquiryOrder } from "@/server/services/bulk";
import { getDb } from "@/server/db/client";
import { parseRupeesToPaise } from "@/lib/money";

export async function updateOrderStatusAction(orderId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    const to = fd.str(form, "status") as OrderStatus;
    if (!(to in ORDER_STATUS_LABELS)) throw new ValidationError("Choose a status.");
    const order = await updateOrderStatus(ctx.db, orderId, to, ctx.actor, { note: fd.str(form, "note"), cancelReason: fd.str(form, "cancelReason") });
    await ctx.audit("order.status_changed", "order", orderId, { to, orderNumber: order.orderNumber });
    if (fd.bool(form, "notify")) after(() => notifyOrder(getDb(), orderId, to === "cancelled" ? "cancelled" : "status").catch((e) => console.error(e)));
    return `Order moved to ${ORDER_STATUS_LABELS[to]}.`;
  });
}

export async function addOrderNoteAction(orderId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await addOrderNote(ctx.db, orderId, fd.str(form, "note"), ctx.actor);
    return "Note added.";
  }, { revalidate: false });
}

export async function recordPaymentAction(orderId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await recordOfflinePayment(ctx.db, orderId, ctx.actor, { method: fd.str(form, "method") || "cash", reference: fd.str(form, "reference") });
    await ctx.audit("order.payment_recorded", "order", orderId, { method: fd.str(form, "method") });
    return "Payment recorded.";
  });
}

export async function refundAction(orderId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    const amount = parseRupeesToPaise(fd.str(form, "amount"));
    if (!amount) throw new ValidationError("Enter the amount to refund in rupees.", { amount: "Required" });
    await refundOrder(ctx.db, orderId, amount, fd.str(form, "reason"), ctx.actor);
    await ctx.audit("order.refund", "order", orderId, { amountPaise: amount, reason: fd.str(form, "reason").slice(0, 200) });
    return "Refund recorded.";
  });
}

export async function createOrderFromEnquiryAction(enquiryId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  let createdId: string | null = null;
  const state = await adminAction(async (ctx) => {
    const items = [];
    for (let i = 0; i < 30; i++) {
      const description = fd.str(form, `item_${i}_description`).trim();
      if (!description) continue;
      const unitPricePaise = parseRupeesToPaise(fd.str(form, `item_${i}_price`));
      const quantity = Number(fd.str(form, `item_${i}_quantity`));
      if (!unitPricePaise || !Number.isInteger(quantity) || quantity < 1) throw new ValidationError(`Line ${i + 1}: enter a whole-number quantity and a price.`);
      items.push({ description, quantity, unitLabel: fd.str(form, `item_${i}_unit`) || "unit", unitPricePaise });
    }
    const order = await createManualOrder(
      ctx.db,
      {
        customerName: fd.str(form, "customerName"),
        phone: fd.str(form, "phone"),
        email: fd.str(form, "email"),
        addressLine1: fd.str(form, "address"),
        locality: fd.str(form, "locality"),
        city: fd.str(form, "city"),
        pincode: fd.str(form, "pincode"),
        deliveryDate: fd.str(form, "deliveryDate"),
        slotLabel: fd.str(form, "slotLabel"),
        notes: fd.str(form, "notes"),
        deliveryFeePaise: parseRupeesToPaise(fd.str(form, "deliveryFee") || "0") ?? 0,
        paymentStatus: fd.bool(form, "paid") ? "paid" : "unpaid",
        items,
      },
      ctx.actor,
      { bulkEnquiryId: enquiryId },
    );
    await linkEnquiryOrder(ctx.db, enquiryId, order.id);
    await ctx.audit("order.created_from_enquiry", "order", order.id, { enquiryId, orderNumber: order.orderNumber });
    createdId = order.id;
    return `Order ${order.orderNumber} created.`;
  });
  if (state.ok && createdId) redirect(`/admin/orders/${createdId}`);
  return state;
}

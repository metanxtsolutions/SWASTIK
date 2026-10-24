"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { adminAction, fd } from "@/server/admin-action";
import type { ActionState } from "@/server/admin-action-types";
import { ValidationError } from "@/server/errors";
import { contactMessages, coupons, deliveryBlackouts } from "@/server/db/schema";
import { ENQUIRY_STATUS_LABELS, updateEnquiry, type EnquiryStatus } from "@/server/services/bulk";
import { addBlackout, deleteSlot, deleteZone, saveCoupon, saveSlot, saveZone } from "@/server/services/admin-ops";
import { parseRupeesToPaise } from "@/lib/money";

export async function updateEnquiryAction(enquiryId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    const status = fd.str(form, "status") as EnquiryStatus;
    if (!(status in ENQUIRY_STATUS_LABELS)) throw new ValidationError("Choose a status.");
    const quoted = fd.str(form, "quotedAmount").trim();
    const followUp = fd.str(form, "nextFollowUpAt");
    await updateEnquiry(ctx.db, enquiryId, {
      status,
      note: fd.str(form, "note"),
      noteKind: (["note", "quotation", "follow_up"].includes(fd.str(form, "noteKind")) ? fd.str(form, "noteKind") : "note") as "note",
      quotedAmountPaise: quoted ? (parseRupeesToPaise(quoted) ?? undefined) : null,
      nextFollowUpAt: followUp ? new Date(`${followUp}T09:00:00+05:30`) : null,
    });
    await ctx.audit("enquiry.updated", "bulk_enquiry", enquiryId, { status });
    return "Enquiry updated.";
  }, { revalidate: false });
}

function zonePayload(form: FormData) {
  return {
    name: fd.str(form, "name"),
    slug: fd.str(form, "slug"),
    isActive: fd.bool(form, "isActive"),
    deliveryFee: fd.str(form, "deliveryFee"),
    minOrder: fd.str(form, "minOrder"),
    freeDeliveryAbove: fd.str(form, "freeDeliveryAbove"),
    minLeadDays: fd.str(form, "minLeadDays"),
    maxAdvanceDays: fd.str(form, "maxAdvanceDays"),
    sameDayEnabled: fd.bool(form, "sameDayEnabled"),
    sameDayCutoff: fd.str(form, "sameDayCutoff"),
    instructions: fd.str(form, "instructions"),
    landingPublished: fd.bool(form, "landingPublished"),
    landingTitle: fd.str(form, "landingTitle"),
    landingContent: fd.str(form, "landingContent"),
    sortOrder: fd.str(form, "sortOrder"),
    pincodes: fd.str(form, "pincodes"),
  };
}

export async function saveZoneAction(zoneId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  let created: string | null = null;
  const state = await adminAction(async (ctx) => {
    const id = await saveZone(ctx.db, zoneId === "new" ? null : zoneId, zonePayload(form));
    await ctx.audit(zoneId === "new" ? "zone.created" : "zone.updated", "delivery_zone", id, { active: fd.bool(form, "isActive") });
    if (zoneId === "new") created = id;
    return "Delivery area saved.";
  });
  if (created) redirect(`/admin/delivery/${created}`);
  return state;
}

export async function deleteZoneAction(zoneId: string): Promise<ActionState> {
  let done = false;
  const state = await adminAction(async (ctx) => {
    await deleteZone(ctx.db, zoneId);
    await ctx.audit("zone.deleted", "delivery_zone", zoneId);
    done = true;
    return "Deleted.";
  });
  if (done) redirect("/admin/delivery");
  return state;
}

export async function saveSlotAction(zoneId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    const slotId = fd.str(form, "slotId") || null;
    await saveSlot(ctx.db, zoneId, slotId, {
      label: fd.str(form, "label"),
      startTime: fd.str(form, "startTime"),
      endTime: fd.str(form, "endTime"),
      cutoffMinutes: String(Math.round(Number(fd.str(form, "cutoffHours") || "2") * 60)),
      capacity: fd.str(form, "capacity"),
      daysOfWeek: fd.all(form, "daysOfWeek"),
      isActive: fd.bool(form, "isActive"),
      sortOrder: fd.str(form, "sortOrder"),
    });
    await ctx.audit(slotId ? "slot.updated" : "slot.created", "delivery_zone", zoneId);
    return "Time slot saved.";
  });
}

export async function deleteSlotAction(zoneId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await deleteSlot(ctx.db, fd.str(form, "slotId"));
    await ctx.audit("slot.deleted", "delivery_zone", zoneId);
    return "Time slot removed.";
  });
}

export async function addBlackoutAction(zoneId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await addBlackout(ctx.db, { zoneId: zoneId === "all" ? null : zoneId, date: fd.str(form, "date"), reason: fd.str(form, "reason") });
    return "Date closed for delivery.";
  });
}

export async function removeBlackoutAction(_id: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await ctx.db.delete(deliveryBlackouts).where(eq(deliveryBlackouts.id, fd.str(form, "blackoutId")));
    return "Date reopened.";
  });
}

export async function saveCouponAction(couponId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await saveCoupon(ctx.db, couponId === "new" ? null : couponId, {
      code: fd.str(form, "code"),
      description: fd.str(form, "description"),
      type: fd.str(form, "type"),
      percent: fd.str(form, "percent"),
      amount: fd.str(form, "amount"),
      minOrder: fd.str(form, "minOrder"),
      maxDiscount: fd.str(form, "maxDiscount"),
      startsAt: fd.str(form, "startsAt"),
      endsAt: fd.str(form, "endsAt"),
      usageLimit: fd.str(form, "usageLimit"),
      perPhoneLimit: fd.str(form, "perPhoneLimit"),
      isActive: fd.bool(form, "isActive"),
    });
    await ctx.audit(couponId === "new" ? "coupon.created" : "coupon.updated", "coupon", couponId === "new" ? null : couponId, { code: fd.str(form, "code").toUpperCase() });
    return "Promo code saved.";
  });
}

export async function toggleCouponAction(couponId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await ctx.db.update(coupons).set({ isActive: fd.str(form, "active") === "1", updatedAt: new Date() }).where(eq(coupons.id, couponId));
    await ctx.audit("coupon.toggled", "coupon", couponId, { active: fd.str(form, "active") === "1" });
    return "Updated.";
  });
}

export async function resolveMessageAction(messageId: string, _prev: ActionState, form: FormData): Promise<ActionState> {
  return adminAction(async (ctx) => {
    await ctx.db.update(contactMessages).set({ isResolved: fd.str(form, "resolved") === "1" }).where(eq(contactMessages.id, messageId));
    return "Updated.";
  }, { revalidate: false });
}

import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bulkEnquiries, bulkEnquiryItems, orders } from "@/server/db/schema";
import { ValidationError } from "@/server/errors";
import { linkEnquiryOrder, submitBulkEnquiry, submitContact, updateEnquiry } from "@/server/services/bulk";
import { createManualOrder, getOrderByAccess, orderAccessToken, placeOrder, trackOrder } from "@/server/services/orders";
import { checkoutInput, db, enableCod, makeCatalogue, makeZone, NOW } from "./helpers";

const enquiry = {
  institutionName: "Sri Radha Krishna Mandir",
  contactName: "Gopal Das",
  phone: "+91 98300 12345",
  address: "Temple Road, Rishra",
  pincode: "712248",
  deliveryDate: "2027-03-10",
  frequency: "weekly",
  recurringDetails: "Every Monday",
  items: [
    { flower: "Marigold (orange)", quantity: "25", unit: "kg" },
    { flower: "Lotus", quantity: 108, unit: "pieces", notes: "For Sandhi Puja" },
    { flower: "Bel patra", quantity: 2.5, unit: "bundles" },
  ],
};

describe("bulk enquiries", () => {
  it("stores an enquiry with several flower varieties", async () => {
    const r = await submitBulkEnquiry(db(), enquiry, { now: NOW });
    expect(r.reference).toMatch(/^BQ-[A-Z0-9]{6}$/);
    const [row] = await db().select().from(bulkEnquiries).where(eq(bulkEnquiries.id, r.id));
    expect(row).toMatchObject({ phone: "9830012345", status: "new", frequency: "weekly" });
    const items = await db().select().from(bulkEnquiryItems).where(eq(bulkEnquiryItems.enquiryId, r.id));
    expect(items.map((i) => [i.flower, Number(i.quantity), i.unit])).toEqual([
      ["Marigold (orange)", 25, "kg"],
      ["Lotus", 108, "pieces"],
      ["Bel patra", 2.5, "bundles"],
    ]);
  });

  it("validates the enquiry and blocks obvious spam", async () => {
    await expect(submitBulkEnquiry(db(), { ...enquiry, items: [] }, { now: NOW })).rejects.toBeInstanceOf(ValidationError);
    await expect(submitBulkEnquiry(db(), { ...enquiry, phone: "123" }, { now: NOW })).rejects.toThrow(/highlighted/);
    await expect(submitBulkEnquiry(db(), { ...enquiry, website: "spam.example" }, { now: NOW })).rejects.toBeInstanceOf(ValidationError);
    await expect(submitBulkEnquiry(db(), { ...enquiry, startedAt: NOW.getTime() - 500 }, { now: NOW })).rejects.toThrow(/moment/);
    await expect(submitBulkEnquiry(db(), { ...enquiry, deliveryDate: "2027-02-01" }, { now: NOW })).rejects.toThrow(/past/);
    expect(await db().select().from(bulkEnquiries)).toHaveLength(0);
  });

  it("records quotations, status changes and the confirmed order", async () => {
    const r = await submitBulkEnquiry(db(), enquiry, { now: NOW });
    await updateEnquiry(db(), r.id, { status: "quoted", quotedAmountPaise: 450000, note: "Called, sent rates on WhatsApp", noteKind: "quotation" });
    const order = await createManualOrder(
      db(),
      { customerName: enquiry.institutionName, phone: "9830012345", addressLine1: enquiry.address, city: "Rishra", pincode: "712248", deliveryDate: "2027-03-10", deliveryFeePaise: 0, paymentStatus: "unpaid", items: [{ description: "Marigold (orange)", quantity: 25, unitLabel: "kg", unitPricePaise: 18000 }] },
      "admin:test",
      { bulkEnquiryId: r.id },
    );
    await linkEnquiryOrder(db(), r.id, order.id);
    expect(order).toMatchObject({ status: "confirmed", totalPaise: 450000, source: "bulk_enquiry" });
    const [row] = await db().select().from(bulkEnquiries).where(eq(bulkEnquiries.id, r.id));
    expect(row.status).toBe("converted");
    expect(row.convertedOrderId).toBe(order.id);
  });

  it("stores contact messages", async () => {
    await expect(submitContact(db(), { name: "A", phone: "98", message: "" })).rejects.toBeInstanceOf(ValidationError);
    const m = await submitContact(db(), { name: "Asha", phone: "9876543210", message: "Do you have lotus this week?" });
    expect(m.phone).toBe("9876543210");
  });
});

describe("order privacy", () => {
  it("shows an order only with its secret link token, and tracking reveals no address", async () => {
    const { variant } = await makeCatalogue();
    const { slot } = await makeZone();
    await enableCod();
    const placed = await placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 11000 }), { now: NOW });
    expect(await getOrderByAccess(db(), placed.orderNumber, undefined)).toBeNull();
    expect(await getOrderByAccess(db(), placed.orderNumber, "x".repeat(32))).toBeNull();
    expect((await getOrderByAccess(db(), placed.orderNumber, placed.accessToken))?.order.id).toBe(placed.orderId);
    // The token is tied to the order: another order's token does not open it.
    const other = await placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 11000 }), { now: NOW });
    expect(await getOrderByAccess(db(), placed.orderNumber, orderAccessToken(other.orderId))).toBeNull();

    expect(await trackOrder(db(), placed.orderNumber, "9000000000")).toBeNull();
    const t = await trackOrder(db(), placed.orderNumber.toLowerCase(), "+91 98765 43210");
    expect(t?.status).toBe("pending_confirmation");
    const json = JSON.stringify(t);
    expect(json).not.toContain("Station Road");
    expect(json).not.toContain("9876543210");
    expect(json).not.toContain("asha@example.com");
  });

  it("uses random, non-sequential order numbers", async () => {
    const { variant } = await makeCatalogue({ stock: 100 });
    const { slot } = await makeZone();
    await enableCod();
    const a = await placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 11000 }), { now: NOW });
    const b = await placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 11000 }), { now: NOW });
    expect(a.orderNumber).not.toBe(b.orderNumber);
    expect(await db().select().from(orders)).toHaveLength(2);
  });
});

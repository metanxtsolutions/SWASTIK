import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { coupons, orderItems, orders, productVariants, stockMovements } from "@/server/db/schema";
import { expireUnpaidOrders, placeOrder, updateOrderStatus } from "@/server/services/orders";
import { saveSettings } from "@/server/services/settings";
import { AppError, ConflictError, ValidationError } from "@/server/errors";
import { checkoutInput, db, enableCod, makeCatalogue, makeCoupon, makeZone, NOW, TOMORROW } from "./helpers";

async function stockOf(id: string) {
  const [v] = await db().select().from(productVariants).where(eq(productVariants.id, id));
  return v.stockQuantity;
}

describe("guest checkout", () => {
  it("refuses Cash on Delivery until the owner enables it", async () => {
    const { variant } = await makeCatalogue();
    const { slot } = await makeZone();
    await expect(placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 11000 }), { now: NOW })).rejects.toThrow(/Cash on Delivery is not available/);
  });

  it("creates a COD order with server prices, snapshots and reserved stock", async () => {
    const { variant } = await makeCatalogue({ price: 4000, stock: 10 });
    const { slot } = await makeZone({ fee: 3000 });
    await enableCod();
    const placed = await placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 11000 }), { now: NOW });
    expect(placed.status).toBe("pending_confirmation");
    expect(placed.orderNumber).toMatch(/^SW-[A-Z0-9]{8}$/);
    const [o] = await db().select().from(orders).where(eq(orders.id, placed.orderId));
    expect(o.totalPaise).toBe(11000);
    expect(o.deliveryFeePaise).toBe(3000);
    expect(o.paymentStatus).toBe("unpaid");
    expect(o.slotLabel).toBe("Morning");
    const items = await db().select().from(orderItems).where(eq(orderItems.orderId, o.id));
    expect(items[0]).toMatchObject({ productName: "Marigold Loose", variantLabel: "250 g", unitPricePaise: 4000, quantity: 2, lineTotalPaise: 8000, unitLabel: "250 g pack" });
    expect(await stockOf(variant.id)).toBe(8);
    // Changing the catalogue afterwards does not rewrite the order.
    await db().update(productVariants).set({ pricePaise: 9900 }).where(eq(productVariants.id, variant.id));
    const [after] = await db().select().from(orderItems).where(eq(orderItems.orderId, o.id));
    expect(after.unitPricePaise).toBe(4000);
  });

  it("rejects a total the customer did not see (manipulated or changed prices)", async () => {
    const { variant } = await makeCatalogue({ price: 4000 });
    const { slot } = await makeZone({ fee: 3000 });
    await enableCod();
    await expect(placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 100 }), { now: NOW })).rejects.toBeInstanceOf(ConflictError);
    expect(await db().select().from(orders)).toHaveLength(0);
    expect(await stockOf(variant.id)).toBe(10);
  });

  it("ignores any price fields sent by the browser", async () => {
    const { variant } = await makeCatalogue({ price: 4000 });
    const { slot } = await makeZone({ fee: 0 });
    await enableCod();
    const input = { ...checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 8000 }), lines: [{ variantId: variant.id, quantity: 2, unitPricePaise: 1 }], totalPaise: 1 };
    const placed = await placeOrder(db(), input, { now: NOW });
    expect(placed.totalPaise).toBe(8000);
  });

  it("returns the same order when a submission is retried with the same key", async () => {
    const { variant } = await makeCatalogue();
    const { slot } = await makeZone();
    await enableCod();
    const input = checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 11000 });
    const first = await placeOrder(db(), input, { now: NOW });
    const again = await placeOrder(db(), input, { now: NOW });
    expect(again.orderId).toBe(first.orderId);
    expect(again.replayed).toBe(true);
    expect(await db().select().from(orders)).toHaveLength(1);
    expect(await stockOf(variant.id)).toBe(8);
  });

  it("sells the last units only once when two customers check out at the same time", async () => {
    const { variant } = await makeCatalogue({ stock: 2 });
    const { slot } = await makeZone();
    await enableCod();
    const results = await Promise.allSettled([
      placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 11000 }), { now: NOW }),
      placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 11000, phone: "9123456780" }), { now: NOW }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(AppError);
    expect(await stockOf(variant.id)).toBe(0);
  });

  it("validates the PIN code, date and slot on the server", async () => {
    const { variant } = await makeCatalogue();
    const { slot } = await makeZone();
    await enableCod();
    await expect(placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, pincode: "700001", expectedTotalPaise: 8000 }), { now: NOW })).rejects.toThrow(/do not deliver/);
    await expect(placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, deliveryDate: "2027-03-01", expectedTotalPaise: 11000 }), { now: NOW })).rejects.toThrow(/no longer available/);
    await expect(placeOrder(db(), checkoutInput(variant.id, { slotId: null, expectedTotalPaise: 11000 }), { now: NOW })).rejects.toThrow(/time slot/);
    // The 7 am slot closes 10 hours before: at 22:00 IST the evening before it is closed.
    const late = new Date("2027-03-01T16:30:00Z");
    await expect(placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 11000 }), { now: late })).rejects.toThrow(/closed/);
  });

  it("enforces slot capacity", async () => {
    const { variant } = await makeCatalogue({ stock: 50 });
    const { slot } = await makeZone({ capacity: 1 });
    await enableCod();
    await placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 11000 }), { now: NOW });
    await expect(placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 11000 }), { now: NOW })).rejects.toThrow(/filled up|Fully booked/);
  });

  it("returns field errors for invalid customer details", async () => {
    const { variant } = await makeCatalogue();
    await makeZone();
    await enableCod();
    try {
      await placeOrder(db(), checkoutInput(variant.id, { phone: "12345", customerName: "", pincode: "abc", expectedTotalPaise: 0 }), { now: NOW });
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      const f = (e as ValidationError).fieldErrors!;
      expect(f.phone).toBeTruthy();
      expect(f.customerName).toBeTruthy();
      expect(f.pincode).toBeTruthy();
    }
  });

  it("rejects the honeypot field", async () => {
    const { variant } = await makeCatalogue();
    await makeZone();
    await enableCod();
    await expect(placeOrder(db(), { ...checkoutInput(variant.id, { expectedTotalPaise: 11000 }), website: "http://spam" }, { now: NOW })).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses orders while ordering is paused", async () => {
    const { variant } = await makeCatalogue();
    const { slot } = await makeZone();
    await saveSettings(db(), "checkout", { codEnabled: true, acceptingOrders: false, pausedMessage: "Closed for Durga Puja" });
    await expect(placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 11000 }), { now: NOW })).rejects.toThrow("Closed for Durga Puja");
  });

  it("records coupon use, and releases stock and coupon use on cancellation", async () => {
    const { variant } = await makeCatalogue({ price: 10000 });
    const { slot } = await makeZone({ fee: 0 });
    await enableCod();
    const c = await makeCoupon({ code: "ONCE", type: "fixed", value: 2000, perPhoneLimit: 1 });
    const placed = await placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, couponCode: "ONCE", expectedTotalPaise: 18000 }), { now: NOW });
    expect((await db().select().from(coupons).where(eq(coupons.id, c.id)))[0].usedCount).toBe(1);
    await expect(placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, couponCode: "ONCE", expectedTotalPaise: 18000 }), { now: NOW })).rejects.toThrow(/already used/);
    await updateOrderStatus(db(), placed.orderId, "cancelled", "admin:test", { cancelReason: "Customer asked" });
    expect(await stockOf(variant.id)).toBe(10);
    expect((await db().select().from(coupons).where(eq(coupons.id, c.id)))[0].usedCount).toBe(0);
    const moves = await db().select().from(stockMovements).where(eq(stockMovements.variantId, variant.id));
    expect(moves.map((m) => m.delta).sort()).toEqual([-2, 2]);
  });

  it("cancels unpaid online orders after the payment window and releases their stock", async () => {
    const { variant } = await makeCatalogue();
    const { slot } = await makeZone();
    const placed = await placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, paymentMethod: "online", expectedTotalPaise: 11000 }), { now: NOW });
    expect(placed.status).toBe("pending_payment");
    expect(await stockOf(variant.id)).toBe(8);
    expect(await expireUnpaidOrders(db(), new Date(NOW.getTime() + 10 * 60_000))).toBe(0);
    expect(await expireUnpaidOrders(db(), new Date(NOW.getTime() + 31 * 60_000))).toBe(1);
    const [o] = await db().select().from(orders).where(eq(orders.id, placed.orderId));
    expect(o.status).toBe("cancelled");
    expect(await stockOf(variant.id)).toBe(10);
  });

  it("only allows sensible status changes", async () => {
    const { variant } = await makeCatalogue();
    const { slot } = await makeZone();
    await enableCod();
    const placed = await placeOrder(db(), checkoutInput(variant.id, { slotId: slot!.id, expectedTotalPaise: 11000 }), { now: NOW });
    await expect(updateOrderStatus(db(), placed.orderId, "delivered", "admin:test")).rejects.toThrow(/cannot be moved/);
    await updateOrderStatus(db(), placed.orderId, "confirmed", "admin:test");
    await updateOrderStatus(db(), placed.orderId, "out_for_delivery", "admin:test");
    const o = await updateOrderStatus(db(), placed.orderId, "delivered", "admin:test");
    expect(o.deliveredAt).toBeTruthy();
    await expect(updateOrderStatus(db(), placed.orderId, "cancelled", "admin:test", { cancelReason: "x" })).rejects.toThrow();
  });

  it("supports same-day delivery only before the cut-off when enabled", async () => {
    const { variant } = await makeCatalogue();
    await makeZone({ slots: false, sameDay: true, cutoff: "12:00", leadDays: 0 });
    await enableCod();
    const today = "2027-03-01";
    const placed = await placeOrder(db(), checkoutInput(variant.id, { deliveryDate: today, expectedTotalPaise: 11000 }), { now: NOW });
    expect(placed.status).toBe("pending_confirmation");
    const afternoon = new Date("2027-03-01T08:00:00Z"); // 13:30 IST
    await expect(placeOrder(db(), checkoutInput(variant.id, { deliveryDate: today, expectedTotalPaise: 11000 }), { now: afternoon })).rejects.toThrow(/no longer available/);
    await expect(placeOrder(db(), checkoutInput(variant.id, { deliveryDate: TOMORROW, expectedTotalPaise: 11000 }), { now: afternoon })).resolves.toBeTruthy();
  });
});

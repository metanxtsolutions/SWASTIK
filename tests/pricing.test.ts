import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { products, productVariants } from "@/server/db/schema";
import { quoteCart } from "@/server/services/pricing";
import { saveSettings } from "@/server/services/settings";
import { db, makeCatalogue, makeCoupon, makeZone, NOW } from "./helpers";

describe("server-side cart pricing", () => {
  it("prices lines from the database and merges duplicate lines", async () => {
    const { variant } = await makeCatalogue({ price: 4000 });
    const q = await quoteCart(db(), { lines: [{ variantId: variant.id, quantity: 1 }, { variantId: variant.id, quantity: 2 }] });
    expect(q.lines).toHaveLength(1);
    expect(q.lines[0].quantity).toBe(3);
    expect(q.lines[0].unitPricePaise).toBe(4000);
    expect(q.itemsSubtotalPaise).toBe(12000);
    expect(q.lines[0].unitText).toBe("per 250 g pack");
  });

  it("uses the sale price when set", async () => {
    const { variant } = await makeCatalogue({ price: 4000, salePrice: 3500 });
    const q = await quoteCart(db(), { lines: [{ variantId: variant.id, quantity: 2 }] });
    expect(q.itemsSubtotalPaise).toBe(7000);
    expect(q.lines[0].regularPricePaise).toBe(4000);
  });

  it("flags quantities above stock and below the minimum", async () => {
    const { variant } = await makeCatalogue({ stock: 3, minQty: 2 });
    expect((await quoteCart(db(), { lines: [{ variantId: variant.id, quantity: 5 }] })).lines[0].issue).toBe("Only 3 available");
    expect((await quoteCart(db(), { lines: [{ variantId: variant.id, quantity: 1 }] })).lines[0].issue).toBe("Minimum order is 2");
    const ok = await quoteCart(db(), { lines: [{ variantId: variant.id, quantity: 3 }] });
    expect(ok.lines[0].issue).toBeNull();
  });

  it("reports unpublished or removed products as missing", async () => {
    const { product, variant } = await makeCatalogue();
    await db().update(products).set({ status: "draft" }).where(eq(products.id, product.id));
    const q = await quoteCart(db(), { lines: [{ variantId: variant.id, quantity: 1 }] });
    expect(q.missingVariantIds).toEqual([variant.id]);
    expect(q.canCheckout).toBe(false);
  });

  it("adds the zone delivery fee and waives it above the free-delivery threshold", async () => {
    const { variant } = await makeCatalogue({ price: 4000, stock: 50 });
    await makeZone({ fee: 3000, freeAbove: 20000 });
    const small = await quoteCart(db(), { lines: [{ variantId: variant.id, quantity: 2 }], pincode: "712248" });
    expect(small.deliveryFeePaise).toBe(3000);
    expect(small.totalPaise).toBe(11000);
    const large = await quoteCart(db(), { lines: [{ variantId: variant.id, quantity: 5 }], pincode: "712248" });
    expect(large.deliveryFeePaise).toBe(0);
    expect(large.totalPaise).toBe(20000);
  });

  it("blocks checkout for PIN codes outside the delivery areas and below the minimum order", async () => {
    const { variant } = await makeCatalogue({ price: 4000 });
    await makeZone({ minOrder: 10000 });
    const outside = await quoteCart(db(), { lines: [{ variantId: variant.id, quantity: 1 }], pincode: "700001" });
    expect(outside.delivery?.serviceable).toBe(false);
    expect(outside.canCheckout).toBe(false);
    const below = await quoteCart(db(), { lines: [{ variantId: variant.id, quantity: 1 }], pincode: "712248" });
    expect(below.issues.join(" ")).toMatch(/minimum order/i);
  });

  it("applies percentage, fixed and free-delivery coupons with their limits", async () => {
    const { variant } = await makeCatalogue({ price: 10000, stock: 50 });
    await makeZone({ fee: 3000 });
    await makeCoupon({ code: "TENOFF", type: "percent", value: 10, maxDiscountPaise: 1500 });
    await makeCoupon({ code: "FLAT50", type: "fixed", value: 5000, minOrderPaise: 20000 });
    await makeCoupon({ code: "FREEDEL", type: "free_delivery" });
    await makeCoupon({ code: "OLD", type: "fixed", value: 100, endsAt: new Date("2020-01-01") });
    await makeCoupon({ code: "USEDUP", type: "fixed", value: 100, usageLimit: 1, usedCount: 1 });
    const base = { lines: [{ variantId: variant.id, quantity: 2 }], pincode: "712248" };
    expect((await quoteCart(db(), { ...base, couponCode: "tenoff" })).discountPaise).toBe(1500);
    expect((await quoteCart(db(), { ...base, couponCode: "FLAT50" })).discountPaise).toBe(5000);
    const small = await quoteCart(db(), { ...base, lines: [{ variantId: variant.id, quantity: 1 }], couponCode: "FLAT50" });
    expect(small.discountPaise).toBe(0);
    expect(small.couponError).toMatch(/at least/);
    const free = await quoteCart(db(), { ...base, couponCode: "FREEDEL" });
    expect(free.discountPaise).toBe(3000);
    expect(free.totalPaise).toBe(20000);
    expect((await quoteCart(db(), { ...base, couponCode: "OLD" }, { now: NOW })).couponError).toMatch(/expired/);
    expect((await quoteCart(db(), { ...base, couponCode: "USEDUP" })).couponError).toMatch(/limit/);
    expect((await quoteCart(db(), { ...base, couponCode: "NOPE" })).couponError).toMatch(/not valid/);
  });

  it("respects products restricted to some delivery areas", async () => {
    const { variant, product } = await makeCatalogue();
    await makeZone();
    const { deliveryZones, productZones, zonePincodes } = await import("@/server/db/schema");
    const [other] = await db().insert(deliveryZones).values({ name: "Konnagar", slug: "konnagar", isActive: true }).returning();
    await db().insert(zonePincodes).values({ pincode: "712235", zoneId: other.id });
    await db().insert(productZones).values({ productId: product.id, zoneId: other.id });
    const q = await quoteCart(db(), { lines: [{ variantId: variant.id, quantity: 1 }], pincode: "712248" });
    expect(q.lines[0].issue).toMatch(/Not available for delivery/);
  });

  it("caps quantity per line using the checkout setting", async () => {
    const { variant } = await makeCatalogue({ stock: 500 });
    await saveSettings(db(), "checkout", { maxQuantityPerLine: 20 });
    const q = await quoteCart(db(), { lines: [{ variantId: variant.id, quantity: 25 }] });
    expect(q.lines[0].issue).toBe("Maximum 20 per order");
    await db().update(productVariants).set({ maxOrderQty: 5 }).where(eq(productVariants.id, variant.id));
    expect((await quoteCart(db(), { lines: [{ variantId: variant.id, quantity: 6 }] })).lines[0].issue).toBe("Maximum 5 per order");
  });
});

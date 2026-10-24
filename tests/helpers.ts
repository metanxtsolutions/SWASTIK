import { randomUUID } from "node:crypto";
import { getDb } from "@/server/db/client";
import { categories, coupons, deliverySlots, deliveryZones, products, productVariants, zonePincodes } from "@/server/db/schema";
import { saveSettings } from "@/server/services/settings";
import type { CheckoutInput } from "@/server/services/orders";

export const db = () => getDb();

/** 10:00 IST on 1 March 2027 (a Monday). Tests pass this as "now". */
export const NOW = new Date("2027-03-01T04:30:00Z");
export const TOMORROW = "2027-03-02";

export async function makeCatalogue(opts: { stock?: number; price?: number; salePrice?: number | null; track?: boolean; minQty?: number } = {}) {
  const [cat] = await db().insert(categories).values({ name: "Marigold Flowers", slug: "marigold-flowers" }).returning();
  const [product] = await db()
    .insert(products)
    .values({ name: "Marigold Loose", slug: "marigold-loose", categoryId: cat.id, status: "published", description: "Fresh loose marigold flowers for puja and garlands.", unit: "pack" })
    .returning();
  const [variant] = await db()
    .insert(productVariants)
    .values({ productId: product.id, label: "250 g", sku: `MRG-${randomUUID().slice(0, 6)}`, unit: "pack", pricePaise: opts.price ?? 4000, salePricePaise: opts.salePrice ?? null, stockQuantity: opts.stock ?? 10, trackInventory: opts.track ?? true, minOrderQty: opts.minQty ?? 1 })
    .returning();
  return { cat, product, variant };
}

export async function makeZone(opts: { fee?: number; minOrder?: number; freeAbove?: number | null; slots?: boolean; capacity?: number | null; sameDay?: boolean; cutoff?: string | null; leadDays?: number } = {}) {
  const [zone] = await db()
    .insert(deliveryZones)
    .values({ name: "Rishra", slug: "rishra", isActive: true, deliveryFeePaise: opts.fee ?? 3000, minOrderPaise: opts.minOrder ?? 0, freeDeliveryAbovePaise: opts.freeAbove ?? null, minLeadDays: opts.leadDays ?? 1, sameDayEnabled: opts.sameDay ?? false, sameDayCutoff: opts.cutoff ?? null })
    .returning();
  await db().insert(zonePincodes).values({ pincode: "712248", zoneId: zone.id, localities: "Rishra" });
  let slot = null;
  if (opts.slots !== false) {
    [slot] = await db()
      .insert(deliverySlots)
      .values({ zoneId: zone.id, label: "Morning", startTime: "07:00", endTime: "10:00", cutoffMinutes: 600, capacity: opts.capacity ?? null })
      .returning();
  }
  return { zone, slot };
}

export async function makeCoupon(values: Partial<typeof coupons.$inferInsert> & { code: string; type: "percent" | "fixed" | "free_delivery" }) {
  const [c] = await db().insert(coupons).values({ value: 0, ...values }).returning();
  return c;
}

export async function enableCod() {
  await saveSettings(db(), "checkout", { codEnabled: true });
}

export function checkoutInput(variantId: string, overrides: Partial<CheckoutInput> = {}): CheckoutInput {
  return {
    idempotencyKey: randomUUID(),
    lines: [{ variantId, quantity: 2 }],
    customerName: "Asha Devi",
    phone: "9876543210",
    email: "asha@example.com",
    addressLine1: "12 Station Road",
    locality: "Rishra",
    city: "Rishra",
    pincode: "712248",
    deliveryDate: TOMORROW,
    slotId: null,
    paymentMethod: "cod",
    expectedTotalPaise: 0,
    ...overrides,
  };
}

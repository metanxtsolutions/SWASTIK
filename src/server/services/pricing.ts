import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { DbOrTx } from "../db/client";
import { couponRedemptions, coupons, media, productImages, products, productVariants, productZones } from "../db/schema";
import { perUnit, unitLabel, type SaleUnit } from "@/lib/units";
import { formatINR } from "@/lib/money";
import { deliveryFee, findZoneForPincode, PINCODE_PATTERN, type Zone } from "./delivery";
import { getSettings } from "./settings";

/**
 * Server-side pricing. The browser only sends variant ids and quantities; prices,
 * stock, discounts and delivery fees always come from the database here. The cart
 * page and checkout both use this, and placing an order recomputes it inside the
 * order transaction with the variant rows locked.
 */

export const cartLinesSchema = z
  .array(z.object({ variantId: z.string().uuid(), quantity: z.number().int().min(1).max(1000) }))
  .max(50, "A cart can hold up to 50 different items");

export type CartLineInput = z.infer<typeof cartLinesSchema>[number];

export interface QuoteLine {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantLabel: string;
  sku: string;
  unit: SaleUnit;
  unitText: string; // "per bunch"
  unitLabel: string; // "bunch"
  imageId: string | null;
  imageFilename: string | null;
  unitPricePaise: number;
  regularPricePaise: number;
  quantity: number;
  lineTotalPaise: number;
  minOrderQty: number;
  maxOrderQty: number | null; // includes stock limits
  trackInventory: boolean;
  issue: string | null; // blocking problem with this line
}

export interface QuoteDelivery {
  pincode: string;
  serviceable: boolean;
  zoneId: string | null;
  zoneName: string | null;
  feePaise: number;
  freeDeliveryAbovePaise: number | null;
  minOrderPaise: number;
}

export interface Quote {
  lines: QuoteLine[];
  missingVariantIds: string[]; // no longer sold; the cart should drop them
  itemsSubtotalPaise: number;
  discountPaise: number;
  coupon: { id: string; code: string; description: string } | null;
  couponError: string | null;
  delivery: QuoteDelivery | null;
  deliveryFeePaise: number;
  totalPaise: number;
  issues: string[];
  canCheckout: boolean;
}

type VariantRow = typeof productVariants.$inferSelect & { productName: string; productSlug: string; productStatus: string; categoryVisible: boolean | null };

export async function loadVariants(db: DbOrTx, variantIds: string[], opts: { lock?: boolean } = {}): Promise<VariantRow[]> {
  if (!variantIds.length) return [];
  const ids = [...new Set(variantIds)].sort();
  if (opts.lock) {
    // Lock in a stable order so concurrent checkouts cannot deadlock.
    await db.execute(sql`SELECT id FROM product_variants WHERE id IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `,
    )}) ORDER BY id FOR UPDATE`);
  }
  return db
    .select({
      ...getVariantColumns(),
      productName: products.name,
      productSlug: products.slug,
      productStatus: products.status,
      categoryVisible: sql<boolean | null>`(SELECT c.is_visible FROM categories c WHERE c.id = ${products.categoryId})`,
    })
    .from(productVariants)
    .innerJoin(products, eq(products.id, productVariants.productId))
    .where(inArray(productVariants.id, ids));
}

function getVariantColumns() {
  const { id, productId, label, sku, unit, pricePaise, salePricePaise, trackInventory, stockQuantity, minOrderQty, maxOrderQty, isActive, sortOrder, createdAt, updatedAt } = productVariants;
  return { id, productId, label, sku, unit, pricePaise, salePricePaise, trackInventory, stockQuantity, minOrderQty, maxOrderQty, isActive, sortOrder, createdAt, updatedAt };
}

export interface CouponCheck {
  coupon: typeof coupons.$inferSelect | null;
  error: string | null;
}

export async function findCoupon(db: DbOrTx, code: string, opts: { lock?: boolean } = {}) {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  if (opts.lock) await db.execute(sql`SELECT id FROM coupons WHERE code = ${normalized} FOR UPDATE`);
  const [row] = await db.select().from(coupons).where(eq(coupons.code, normalized)).limit(1);
  return row ?? null;
}

/** Checks whether a coupon can be used now for this subtotal (and phone, at checkout). */
export async function checkCoupon(
  db: DbOrTx,
  coupon: typeof coupons.$inferSelect | null,
  itemsSubtotalPaise: number,
  opts: { phone?: string | null; now?: Date } = {},
): Promise<string | null> {
  const now = opts.now ?? new Date();
  if (!coupon || !coupon.isActive) return "This code is not valid.";
  if (coupon.startsAt && coupon.startsAt > now) return "This code is not active yet.";
  if (coupon.endsAt && coupon.endsAt < now) return "This code has expired.";
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) return "This code has reached its usage limit.";
  if (itemsSubtotalPaise < coupon.minOrderPaise) return `This code needs an order of at least ${formatINR(coupon.minOrderPaise)}.`;
  if (opts.phone && coupon.perPhoneLimit !== null) {
    const [{ n }] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(couponRedemptions)
      .where(and(eq(couponRedemptions.couponId, coupon.id), eq(couponRedemptions.phone, opts.phone)));
    if (n >= coupon.perPhoneLimit) return "You have already used this code.";
  }
  return null;
}

export function couponItemDiscount(coupon: typeof coupons.$inferSelect, itemsSubtotalPaise: number): number {
  let d = 0;
  if (coupon.type === "percent") d = Math.floor((itemsSubtotalPaise * coupon.value) / 100);
  else if (coupon.type === "fixed") d = coupon.value;
  if (coupon.maxDiscountPaise !== null) d = Math.min(d, coupon.maxDiscountPaise);
  return Math.max(0, Math.min(d, itemsSubtotalPaise));
}

export interface QuoteInput {
  lines: CartLineInput[];
  pincode?: string | null;
  couponCode?: string | null;
  phone?: string | null;
}

export async function quoteCart(db: DbOrTx, input: QuoteInput, opts: { lock?: boolean; now?: Date } = {}): Promise<Quote> {
  const checkout = await getSettings(db, "checkout");
  // Merge duplicate lines for the same variant.
  const merged = new Map<string, number>();
  for (const l of input.lines) merged.set(l.variantId, (merged.get(l.variantId) ?? 0) + l.quantity);

  const variants = await loadVariants(db, [...merged.keys()], { lock: opts.lock });
  const missingVariantIds = [...merged.keys()].filter((id) => !variants.find((v) => v.id === id && v.isActive && v.productStatus === "published" && v.categoryVisible !== false));

  let zone: Zone | null = null;
  let delivery: QuoteDelivery | null = null;
  const pincode = input.pincode?.replace(/\s/g, "") ?? "";
  if (pincode && PINCODE_PATTERN.test(pincode)) {
    const found = await findZoneForPincode(db, pincode);
    zone = found?.zone ?? null;
    delivery = {
      pincode,
      serviceable: !!zone,
      zoneId: zone?.id ?? null,
      zoneName: zone?.name ?? null,
      feePaise: 0,
      freeDeliveryAbovePaise: zone?.freeDeliveryAbovePaise ?? null,
      minOrderPaise: zone?.minOrderPaise ?? 0,
    };
  }

  const sellable = variants.filter((v) => !missingVariantIds.includes(v.id));
  const productIds = [...new Set(sellable.map((v) => v.productId))];
  const [images, restrictions] = await Promise.all([
    productIds.length
      ? db
          .select({ productId: productImages.productId, mediaId: media.id, filename: media.filename })
          .from(productImages)
          .innerJoin(media, eq(media.id, productImages.mediaId))
          .where(inArray(productImages.productId, productIds))
          .orderBy(asc(productImages.sortOrder), asc(productImages.createdAt))
      : Promise.resolve([]),
    productIds.length ? db.select().from(productZones).where(inArray(productZones.productId, productIds)) : Promise.resolve([]),
  ]);

  const lines: QuoteLine[] = sellable.map((v) => {
    const quantity = merged.get(v.id)!;
    const unitPrice = v.salePricePaise ?? v.pricePaise;
    const stockMax = v.trackInventory ? v.stockQuantity : null;
    const maxOrderQty = [v.maxOrderQty, stockMax, checkout.maxQuantityPerLine].filter((n): n is number => n !== null).reduce((a, b) => Math.min(a, b), Number.MAX_SAFE_INTEGER);
    const productZoneIds = restrictions.filter((r) => r.productId === v.productId).map((r) => r.zoneId);
    let issue: string | null = null;
    if (v.trackInventory && v.stockQuantity < v.minOrderQty) issue = "Out of stock";
    else if (quantity < v.minOrderQty) issue = `Minimum order is ${v.minOrderQty}`;
    else if (quantity > maxOrderQty) issue = stockMax !== null && stockMax === maxOrderQty ? `Only ${stockMax} available` : `Maximum ${maxOrderQty} per order`;
    else if (zone && productZoneIds.length && !productZoneIds.includes(zone.id)) issue = `Not available for delivery to ${pincode}`;
    const img = images.find((i) => i.productId === v.productId);
    return {
      variantId: v.id,
      productId: v.productId,
      slug: v.productSlug,
      name: v.productName,
      variantLabel: v.label,
      sku: v.sku,
      unit: v.unit,
      unitText: perUnit(v.unit, v.label),
      unitLabel: unitLabel(v.unit, v.label),
      imageId: img?.mediaId ?? null,
      imageFilename: img?.filename ?? null,
      unitPricePaise: unitPrice,
      regularPricePaise: v.pricePaise,
      quantity,
      lineTotalPaise: unitPrice * quantity,
      minOrderQty: v.minOrderQty,
      maxOrderQty: maxOrderQty === Number.MAX_SAFE_INTEGER ? null : maxOrderQty,
      trackInventory: v.trackInventory,
      issue,
    };
  });
  // Keep the customer's cart order.
  const order = [...merged.keys()];
  lines.sort((a, b) => order.indexOf(a.variantId) - order.indexOf(b.variantId));

  const valid = lines.filter((l) => !l.issue);
  const itemsSubtotalPaise = valid.reduce((s, l) => s + l.lineTotalPaise, 0);

  let couponRow: typeof coupons.$inferSelect | null = null;
  let couponError: string | null = null;
  if (input.couponCode?.trim()) {
    couponRow = await findCoupon(db, input.couponCode, { lock: opts.lock });
    couponError = await checkCoupon(db, couponRow, itemsSubtotalPaise, { phone: input.phone, now: opts.now });
    if (couponError) couponRow = null;
  }
  let discountPaise = couponRow ? couponItemDiscount(couponRow, itemsSubtotalPaise) : 0;
  const itemsAfterDiscount = itemsSubtotalPaise - discountPaise;
  // Until a serviceable PIN code is entered the delivery fee is unknown and not charged.
  const deliveryFeePaise = zone ? deliveryFee(zone, itemsAfterDiscount) : 0;
  if (couponRow?.type === "free_delivery") discountPaise += deliveryFeePaise;
  if (delivery) delivery.feePaise = deliveryFeePaise;

  const issues: string[] = [];
  if (!lines.length) issues.push("Your cart is empty.");
  if (lines.some((l) => l.issue)) issues.push("Some items need your attention before checkout.");
  if (delivery && !delivery.serviceable) issues.push(`We do not deliver to ${delivery.pincode} yet.`);
  if (zone && itemsAfterDiscount < zone.minOrderPaise) issues.push(`The minimum order for ${zone.name} is ${formatINR(zone.minOrderPaise)}.`);
  if (!checkout.acceptingOrders) issues.push(checkout.pausedMessage);

  return {
    lines,
    missingVariantIds,
    itemsSubtotalPaise,
    discountPaise,
    coupon: couponRow ? { id: couponRow.id, code: couponRow.code, description: couponRow.description } : null,
    couponError,
    delivery,
    deliveryFeePaise,
    totalPaise: itemsSubtotalPaise - discountPaise + deliveryFeePaise,
    issues,
    canCheckout: issues.length === 0 && valid.length > 0,
  };
}

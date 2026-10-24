import { and, asc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import type { DbOrTx } from "../db/client";
import { deliveryBlackouts, deliverySlots, deliveryZones, orders, zonePincodes } from "../db/schema";
import { ValidationError } from "../errors";
import { addDays, daysBetween, formatTime, isIsoDate, minutesNowInIndia, timeToMinutes, todayInIndia, weekday } from "@/lib/dates";

/**
 * Delivery coverage is entirely configured by the owner: zones, their PIN codes,
 * fees, slots, cut-off times and blackout dates. A PIN code that is not in an
 * active zone is not serviceable, and nothing here assumes a particular town.
 */

export type Zone = typeof deliveryZones.$inferSelect;
export type Slot = typeof deliverySlots.$inferSelect;

export interface SlotOption {
  id: string;
  label: string;
  available: boolean;
  reason?: string;
}

export interface DateOption {
  date: string;
  slots: SlotOption[]; // empty when the zone delivers without time slots
}

export interface ServiceablePincode {
  serviceable: true;
  pincode: string;
  zone: { id: string; name: string; slug: string; instructions: string };
  localities: string;
  deliveryFeePaise: number;
  minOrderPaise: number;
  freeDeliveryAbovePaise: number | null;
  sameDayAvailable: boolean;
  usesSlots: boolean;
  dates: DateOption[];
}

export type PincodeCheck = ServiceablePincode | { serviceable: false; pincode: string; reason: "invalid" | "not_served" };

export const PINCODE_PATTERN = /^[1-9]\d{5}$/;

export async function findZoneForPincode(db: DbOrTx, pincode: string): Promise<{ zone: Zone; localities: string } | null> {
  const [row] = await db
    .select({ zone: deliveryZones, localities: zonePincodes.localities })
    .from(zonePincodes)
    .innerJoin(deliveryZones, eq(deliveryZones.id, zonePincodes.zoneId))
    .where(and(eq(zonePincodes.pincode, pincode), eq(deliveryZones.isActive, true)))
    .limit(1);
  return row ?? null;
}

async function blackoutDates(db: DbOrTx, zoneId: string, from: string, to: string): Promise<Set<string>> {
  const rows = await db
    .select({ date: deliveryBlackouts.date })
    .from(deliveryBlackouts)
    .where(and(or(isNull(deliveryBlackouts.zoneId), eq(deliveryBlackouts.zoneId, zoneId)), sql`${deliveryBlackouts.date} BETWEEN ${from} AND ${to}`));
  return new Set(rows.map((r) => r.date));
}

async function slotBookings(db: DbOrTx, slotIds: string[], from: string, to: string): Promise<Map<string, number>> {
  if (!slotIds.length) return new Map();
  const rows = await db
    .select({ slotId: orders.slotId, date: orders.deliveryDate, n: sql<number>`count(*)::int` })
    .from(orders)
    .where(and(inArray(orders.slotId, slotIds), sql`${orders.deliveryDate} BETWEEN ${from} AND ${to}`, sql`${orders.status} <> 'cancelled'`))
    .groupBy(orders.slotId, orders.deliveryDate);
  return new Map(rows.map((r) => [`${r.slotId}|${r.date}`, r.n]));
}

/** The earliest delivery date for a zone right now, applying the lead time and the same-day cut-off. */
export function earliestDate(zone: Pick<Zone, "minLeadDays" | "sameDayEnabled" | "sameDayCutoff">, now = new Date()): string {
  const today = todayInIndia(now);
  if (zone.minLeadDays > 0) return addDays(today, zone.minLeadDays);
  const sameDayOpen = zone.sameDayEnabled && (!zone.sameDayCutoff || minutesNowInIndia(now) < timeToMinutes(zone.sameDayCutoff));
  return sameDayOpen ? today : addDays(today, 1);
}

export function slotLabel(slot: Pick<Slot, "label" | "startTime" | "endTime">): string {
  return slot.label || `${formatTime(slot.startTime)} to ${formatTime(slot.endTime)}`;
}

function slotOpen(slot: Slot, date: string, now: Date): { open: boolean; reason?: string } {
  if (!slot.daysOfWeek.includes(weekday(date))) return { open: false, reason: "Not offered on this day" };
  const today = todayInIndia(now);
  const minutesUntilStart = daysBetween(today, date) * 1440 + timeToMinutes(slot.startTime) - minutesNowInIndia(now);
  if (minutesUntilStart < slot.cutoffMinutes) return { open: false, reason: "Booking for this slot has closed" };
  return { open: true };
}

export async function availableDates(db: DbOrTx, zone: Zone, now = new Date()): Promise<{ dates: DateOption[]; usesSlots: boolean }> {
  const today = todayInIndia(now);
  const first = earliestDate(zone, now);
  const last = addDays(today, Math.max(zone.maxAdvanceDays, daysBetween(today, first)));
  const [slots, blackouts] = await Promise.all([
    db
      .select()
      .from(deliverySlots)
      .where(and(eq(deliverySlots.zoneId, zone.id), eq(deliverySlots.isActive, true)))
      .orderBy(asc(deliverySlots.sortOrder), asc(deliverySlots.startTime)),
    blackoutDates(db, zone.id, first, last),
  ]);
  const bookings = await slotBookings(
    db,
    slots.filter((s) => s.capacity !== null).map((s) => s.id),
    first,
    last,
  );
  const dates: DateOption[] = [];
  for (let d = first; d <= last; d = addDays(d, 1)) {
    if (blackouts.has(d)) continue;
    if (!slots.length) {
      dates.push({ date: d, slots: [] });
      continue;
    }
    const options: SlotOption[] = [];
    for (const s of slots) {
      if (!s.daysOfWeek.includes(weekday(d))) continue;
      const { open, reason } = slotOpen(s, d, now);
      const booked = bookings.get(`${s.id}|${d}`) ?? 0;
      const full = s.capacity !== null && booked >= s.capacity;
      options.push({ id: s.id, label: slotLabel(s), available: open && !full, reason: !open ? reason : full ? "Fully booked" : undefined });
    }
    if (options.some((o) => o.available)) dates.push({ date: d, slots: options });
  }
  return { dates, usesSlots: slots.length > 0 };
}

export async function checkPincode(db: DbOrTx, input: string, now = new Date()): Promise<PincodeCheck> {
  const pincode = input.replace(/\s/g, "");
  if (!PINCODE_PATTERN.test(pincode)) return { serviceable: false, pincode, reason: "invalid" };
  const found = await findZoneForPincode(db, pincode);
  if (!found) return { serviceable: false, pincode, reason: "not_served" };
  const { zone, localities } = found;
  const { dates, usesSlots } = await availableDates(db, zone, now);
  return {
    serviceable: true,
    pincode,
    zone: { id: zone.id, name: zone.name, slug: zone.slug, instructions: zone.instructions },
    localities,
    deliveryFeePaise: zone.deliveryFeePaise,
    minOrderPaise: zone.minOrderPaise,
    freeDeliveryAbovePaise: zone.freeDeliveryAbovePaise,
    sameDayAvailable: dates[0]?.date === todayInIndia(now),
    usesSlots,
    dates,
  };
}

export function deliveryFee(zone: Pick<Zone, "deliveryFeePaise" | "freeDeliveryAbovePaise">, itemsAfterDiscountPaise: number): number {
  if (zone.freeDeliveryAbovePaise !== null && itemsAfterDiscountPaise >= zone.freeDeliveryAbovePaise) return 0;
  return zone.deliveryFeePaise;
}

/**
 * Validates the chosen date and slot at order time. Inside a transaction the
 * slot row is locked so two orders cannot both take the last place in a slot.
 */
export async function validateDeliveryChoice(
  db: DbOrTx,
  input: { pincode: string; date: string; slotId?: string | null },
  now = new Date(),
): Promise<{ zone: Zone; slot: Slot | null }> {
  const found = await findZoneForPincode(db, input.pincode);
  if (!found) throw new ValidationError("We do not deliver to this PIN code yet.", { pincode: "Not in our delivery area" });
  const { zone } = found;
  if (!isIsoDate(input.date)) throw new ValidationError("Choose a delivery date.", { deliveryDate: "Choose a date" });
  const today = todayInIndia(now);
  if (input.date < earliestDate(zone, now)) throw new ValidationError("That delivery date is no longer available. Please choose another date.", { deliveryDate: "No longer available" });
  if (daysBetween(today, input.date) > zone.maxAdvanceDays) throw new ValidationError("That date is too far ahead. Please choose an earlier date.", { deliveryDate: "Too far ahead" });
  const blackouts = await blackoutDates(db, zone.id, input.date, input.date);
  if (blackouts.has(input.date)) throw new ValidationError("We are not delivering on that date. Please choose another date.", { deliveryDate: "No deliveries on this date" });

  const zoneSlots = await db.select({ id: deliverySlots.id }).from(deliverySlots).where(and(eq(deliverySlots.zoneId, zone.id), eq(deliverySlots.isActive, true)));
  if (!zoneSlots.length) return { zone, slot: null };
  if (!input.slotId) throw new ValidationError("Choose a delivery time slot.", { slotId: "Choose a slot" });

  const lockedRows = await db.execute<{ id: string }>(sql`SELECT id FROM delivery_slots WHERE id = ${input.slotId} AND zone_id = ${zone.id} AND is_active FOR UPDATE`);
  if (!lockedRows.rows.length) throw new ValidationError("That time slot is not available. Please choose another.", { slotId: "Not available" });
  const [slot] = await db.select().from(deliverySlots).where(eq(deliverySlots.id, input.slotId));
  const { open, reason } = slotOpen(slot, input.date, now);
  if (!open) throw new ValidationError(`${reason ?? "That slot is not available"}. Please choose another slot.`, { slotId: reason ?? "Not available" });
  if (slot.capacity !== null) {
    const booked = (await slotBookings(db, [slot.id], input.date, input.date)).get(`${slot.id}|${input.date}`) ?? 0;
    if (booked >= slot.capacity) throw new ValidationError("That slot has just filled up. Please choose another slot.", { slotId: "Fully booked" });
  }
  return { zone, slot };
}

export interface PublicZone {
  id: string;
  name: string;
  slug: string;
  pincodes: { pincode: string; localities: string }[];
  deliveryFeePaise: number;
  minOrderPaise: number;
  freeDeliveryAbovePaise: number | null;
  sameDayEnabled: boolean;
  sameDayCutoff: string | null;
  minLeadDays: number;
  instructions: string;
  slots: string[];
  landingPublished: boolean;
  landingTitle: string;
  landingContent: string;
  updatedAt: Date;
}

export async function listActiveZones(db: DbOrTx): Promise<PublicZone[]> {
  const zones = await db.select().from(deliveryZones).where(eq(deliveryZones.isActive, true)).orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.name));
  if (!zones.length) return [];
  const ids = zones.map((z) => z.id);
  const [pins, slots] = await Promise.all([
    db.select().from(zonePincodes).where(inArray(zonePincodes.zoneId, ids)).orderBy(asc(zonePincodes.pincode)),
    db
      .select()
      .from(deliverySlots)
      .where(and(inArray(deliverySlots.zoneId, ids), eq(deliverySlots.isActive, true)))
      .orderBy(asc(deliverySlots.sortOrder), asc(deliverySlots.startTime)),
  ]);
  return zones.map((z) => ({
    id: z.id,
    name: z.name,
    slug: z.slug,
    pincodes: pins.filter((p) => p.zoneId === z.id).map((p) => ({ pincode: p.pincode, localities: p.localities })),
    deliveryFeePaise: z.deliveryFeePaise,
    minOrderPaise: z.minOrderPaise,
    freeDeliveryAbovePaise: z.freeDeliveryAbovePaise,
    sameDayEnabled: z.sameDayEnabled,
    sameDayCutoff: z.sameDayCutoff,
    minLeadDays: z.minLeadDays,
    instructions: z.instructions,
    slots: slots.filter((s) => s.zoneId === z.id).map(slotLabel),
    landingPublished: z.landingPublished,
    landingTitle: z.landingTitle,
    landingContent: z.landingContent,
    updatedAt: z.updatedAt,
  }));
}

/** Location pages are published only for active zones with real content written by the owner. */
export const MIN_LANDING_CONTENT = 300;

export async function listLandingZones(db: DbOrTx): Promise<PublicZone[]> {
  return (await listActiveZones(db)).filter((z) => z.landingPublished && z.landingContent.trim().length >= MIN_LANDING_CONTENT);
}

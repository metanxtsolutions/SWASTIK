import "server-only";
import { asc } from "drizzle-orm";
import type { DbOrTx } from "./db/client";
import { categories, collections, deliveryZones } from "./db/schema";

/** Option lists used by admin forms. */
export async function catalogOptions(db: DbOrTx) {
  const [cats, cols, zones] = await Promise.all([
    db.select({ id: categories.id, name: categories.name }).from(categories).orderBy(asc(categories.sortOrder), asc(categories.name)),
    db.select({ id: collections.id, name: collections.name }).from(collections).orderBy(asc(collections.sortOrder), asc(collections.name)),
    db.select({ id: deliveryZones.id, name: deliveryZones.name }).from(deliveryZones).orderBy(asc(deliveryZones.sortOrder), asc(deliveryZones.name)),
  ]);
  return { categories: cats, collections: cols, zones };
}

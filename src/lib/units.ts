export const SALE_UNITS = ["piece", "bunch", "bundle", "kg", "gram", "garland", "pack", "dozen", "string", "plate", "box", "set"] as const;
export type SaleUnit = (typeof SALE_UNITS)[number];

export const UNIT_NAMES: Record<SaleUnit, { singular: string; plural: string }> = {
  piece: { singular: "piece", plural: "pieces" },
  bunch: { singular: "bunch", plural: "bunches" },
  bundle: { singular: "bundle", plural: "bundles" },
  kg: { singular: "kg", plural: "kg" },
  gram: { singular: "g", plural: "g" },
  garland: { singular: "garland", plural: "garlands" },
  pack: { singular: "pack", plural: "packs" },
  dozen: { singular: "dozen", plural: "dozen" },
  string: { singular: "string", plural: "strings" },
  plate: { singular: "plate", plural: "plates" },
  box: { singular: "box", plural: "boxes" },
  set: { singular: "set", plural: "sets" },
};

/**
 * What one unit of quantity means, written so the price relationship is explicit:
 * "per bunch", "per 250 g pack", "per garland (3 ft)".
 */
export function unitLabel(unit: SaleUnit, variantLabel?: string | null): string {
  const label = variantLabel?.trim();
  if (!label) return UNIT_NAMES[unit].singular;
  // "250 g" with unit pack reads as "250 g pack"; a label that already names the unit is kept as is.
  const lower = label.toLowerCase();
  const names = [UNIT_NAMES[unit].singular, UNIT_NAMES[unit].plural, unit];
  if (unit === "kg" || unit === "gram" || names.some((n) => lower.includes(n))) return label;
  return `${label} ${UNIT_NAMES[unit].singular}`;
}

export function perUnit(unit: SaleUnit, variantLabel?: string | null): string {
  return `per ${unitLabel(unit, variantLabel)}`;
}

export function quantityText(quantity: number, unit: SaleUnit, variantLabel?: string | null): string {
  const label = variantLabel?.trim();
  if (label) return `${quantity} × ${unitLabel(unit, label)}`;
  const n = UNIT_NAMES[unit];
  return `${quantity} ${quantity === 1 ? n.singular : n.plural}`;
}

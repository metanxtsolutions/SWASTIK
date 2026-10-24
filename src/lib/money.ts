/** Money is handled as integer paise everywhere; these helpers convert for display and input. */

const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });

export function formatINR(paise: number): string {
  return inr.format(paise / 100);
}

/** Parses "120", "120.50" or "₹1,200" into paise; returns null when the input is not a valid amount. */
export function parseRupeesToPaise(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).replace(/[₹,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}

export function paiseToRupeesInput(paise: number | null | undefined): string {
  if (paise === null || paise === undefined) return "";
  return (paise / 100).toFixed(2).replace(/\.00$/, "");
}

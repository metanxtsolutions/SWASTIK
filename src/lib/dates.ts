/**
 * Delivery dates are calendar dates in India Standard Time (UTC+05:30, no daylight saving),
 * written as YYYY-MM-DD strings.
 */
const IST_OFFSET_MINUTES = 330;

function istParts(now: Date) {
  const shifted = new Date(now.getTime() + IST_OFFSET_MINUTES * 60_000);
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

export function todayInIndia(now = new Date()): string {
  return istParts(now).date;
}

export function minutesNowInIndia(now = new Date()): number {
  return istParts(now).minutes;
}

export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(`${toIso}T00:00:00Z`) - Date.parse(`${fromIso}T00:00:00Z`)) / 86_400_000);
}

/** 0 = Sunday. */
export function weekday(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00Z`).getUTCDay();
}

export function isIsoDate(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`)) && new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
}

/** "HH:MM" or "HH:MM:SS" to minutes after midnight. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function formatTime(t: string): string {
  const mins = timeToMinutes(t);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

export function formatDeliveryDate(isoDate: string, opts: { withYear?: boolean } = {}): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(opts.withYear ? { year: "numeric" } : {}),
    timeZone: "UTC",
  });
}

export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "Asia/Kolkata" });
}

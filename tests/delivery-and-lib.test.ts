import { describe, expect, it } from "vitest";
import { deliveryBlackouts, deliverySlots } from "@/server/db/schema";
import { checkPincode, earliestDate } from "@/server/services/delivery";
import { parsePincodeLines } from "@/server/services/admin-ops";
import { sniffImageType } from "@/server/storage";
import { formatINR, parseRupeesToPaise } from "@/lib/money";
import { normalizeIndianMobile, whatsappLink } from "@/lib/phone";
import { perUnit, quantityText } from "@/lib/units";
import { toCsv } from "@/lib/csv";
import { db, makeZone, NOW } from "./helpers";

describe("delivery rules", () => {
  it("says when a PIN code is not served or invalid", async () => {
    await makeZone();
    expect(await checkPincode(db(), "12345", NOW)).toMatchObject({ serviceable: false, reason: "invalid" });
    expect(await checkPincode(db(), "700001", NOW)).toMatchObject({ serviceable: false, reason: "not_served" });
    const ok = await checkPincode(db(), "712248", NOW);
    expect(ok.serviceable).toBe(true);
  });

  it("does not offer inactive zones", async () => {
    const { zone } = await makeZone();
    const { deliveryZones } = await import("@/server/db/schema");
    const { eq } = await import("drizzle-orm");
    await db().update(deliveryZones).set({ isActive: false }).where(eq(deliveryZones.id, zone.id));
    expect((await checkPincode(db(), "712248", NOW)).serviceable).toBe(false);
  });

  it("starts from the lead time, skips blackout dates and days without slots", async () => {
    const { zone } = await makeZone({ slots: false });
    await db().insert(deliverySlots).values({ zoneId: zone.id, label: "Weekdays", startTime: "08:00", endTime: "10:00", cutoffMinutes: 60, daysOfWeek: [1, 2, 3, 4, 5] });
    await db().insert(deliveryBlackouts).values({ zoneId: null, date: "2027-03-03", reason: "Holiday" });
    const r = await checkPincode(db(), "712248", NOW);
    if (!r.serviceable) throw new Error("expected serviceable");
    const dates = r.dates.map((d) => d.date);
    expect(dates[0]).toBe("2027-03-02");
    expect(dates).not.toContain("2027-03-03");
    expect(dates).not.toContain("2027-03-06"); // Saturday
    expect(dates).not.toContain("2027-03-07"); // Sunday
  });

  it("offers same-day delivery only when enabled and before the cut-off", () => {
    const zone = { minLeadDays: 0, sameDayEnabled: true, sameDayCutoff: "12:00:00" };
    expect(earliestDate(zone, NOW)).toBe("2027-03-01");
    expect(earliestDate(zone, new Date("2027-03-01T07:00:00Z"))).toBe("2027-03-02");
    expect(earliestDate({ ...zone, sameDayEnabled: false }, NOW)).toBe("2027-03-02");
    expect(earliestDate({ minLeadDays: 2, sameDayEnabled: false, sameDayCutoff: null }, NOW)).toBe("2027-03-03");
  });

  it("parses PIN code lists from the admin form", () => {
    expect(parsePincodeLines("712248, Rishra\n712249 - Prabasnagar\n\n712248")).toEqual([
      { pincode: "712248", localities: "" },
      { pincode: "712249", localities: "Prabasnagar" },
    ]);
    expect(() => parsePincodeLines("71224")).toThrow(/not valid/);
  });
});

describe("helpers", () => {
  it("formats and parses rupees", () => {
    expect(formatINR(12345)).toBe("₹123.45");
    expect(formatINR(150000)).toBe("₹1,500");
    expect(parseRupeesToPaise("₹1,200.5")).toBe(120050);
    expect(parseRupeesToPaise("12.345")).toBeNull();
    expect(parseRupeesToPaise("abc")).toBeNull();
  });

  it("normalises Indian mobile numbers", () => {
    expect(normalizeIndianMobile("+91 98765 43210")).toBe("9876543210");
    expect(normalizeIndianMobile("09876543210")).toBe("9876543210");
    expect(normalizeIndianMobile("1234567890")).toBeNull();
    expect(whatsappLink("98765 43210", "hi")).toBe("https://wa.me/919876543210?text=hi");
    expect(whatsappLink("")).toBeNull();
  });

  it("states what one unit means", () => {
    expect(perUnit("bunch")).toBe("per bunch");
    expect(perUnit("pack", "250 g")).toBe("per 250 g pack");
    expect(perUnit("garland", "3 ft")).toBe("per 3 ft garland");
    expect(perUnit("kg", "1 kg")).toBe("per 1 kg");
    expect(quantityText(3, "piece")).toBe("3 pieces");
  });

  it("detects real image types and refuses others", () => {
    expect(sniffImageType(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(Buffer.from("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffImageType(Buffer.from("GIF89a"))).toBeNull();
  });

  it("neutralises spreadsheet formulas in CSV exports", () => {
    const csv = toCsv(["a", "b"], [["=HYPERLINK(1)", 'say "hi", ok']]);
    expect(csv).toContain("'=HYPERLINK(1)");
    expect(csv).toContain('"say ""hi"", ok"');
  });
});

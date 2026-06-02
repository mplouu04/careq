/**
 * CAREQ Parity Test Suite — lib/* utilities
 *
 * Tests all core library functions against known legacy PHP behaviour.
 * These are pure unit tests; no DB or HTTP required.
 */
import { describe, it, expect } from "vitest";
import { normalizePhone } from "../lib/phone";
import { generateTimeSlots, filterSameDaySlots } from "../lib/slots";

// ─── Phone normalization ────────────────────────────────────────────────────

describe("normalizePhone (pqms_normalize_phone_digits)", () => {
  it("strips non-digits", () => {
    expect(normalizePhone("0917-123-4567")).toBe("09171234567");
    expect(normalizePhone("+63 917 123 4567")).toBe("639171234567");
    expect(normalizePhone("(0917) 123-4567")).toBe("09171234567");
  });

  it("returns empty string for empty input", () => {
    expect(normalizePhone("")).toBe("");
  });

  it("leaves plain digits unchanged", () => {
    expect(normalizePhone("09171234567")).toBe("09171234567");
  });

  it("11-digit Philippine mobile number validation", () => {
    const phone = normalizePhone("0917 123 4567");
    expect(phone.length).toBe(11);
  });

  it("rejects 10-digit number (too short)", () => {
    const phone = normalizePhone("0917123456");
    expect(phone.length).not.toBe(11);
  });
});

// ─── Slot generation ────────────────────────────────────────────────────────

describe("generateTimeSlots (legacy 30-min hardcoded)", () => {
  it("generates slots every 30 minutes", () => {
    const slots = generateTimeSlots("08:00", "17:00", 30);
    expect(slots[0]).toBe("08:00");
    expect(slots[1]).toBe("08:30");
    expect(slots[2]).toBe("09:00");
  });

  it("includes start slot", () => {
    const slots = generateTimeSlots("08:00", "17:00", 30);
    expect(slots).toContain("08:00");
  });

  it("excludes end time", () => {
    const slots = generateTimeSlots("08:00", "17:00", 30);
    expect(slots).not.toContain("17:00");
  });

  it("returns correct count for 08:00-17:00 at 30min", () => {
    // 8:00 to 17:00 = 9 hours = 18 slots
    const slots = generateTimeSlots("08:00", "17:00", 30);
    expect(slots.length).toBe(18);
  });

  it("handles 1-hour intervals", () => {
    const slots = generateTimeSlots("09:00", "12:00", 60);
    expect(slots).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("returns empty array when start >= end", () => {
    const slots = generateTimeSlots("17:00", "08:00", 30);
    expect(slots).toEqual([]);
  });
});

// ─── Same-day slot filtering ─────────────────────────────────────────────────

describe("filterSameDaySlots (pqms_filter_same_day_slots)", () => {
  it("returns all slots unchanged for future dates", () => {
    const futureDate = "2099-12-31";
    const slots = ["08:00", "08:30", "09:00"];
    expect(filterSameDaySlots(slots, futureDate)).toEqual(slots);
  });

  it("returns slots unchanged for a past date (only today gets filtered)", () => {
    // Legacy: pqms_filter_same_day_slots only filters if date === today.
    // A past date does NOT equal today, so slots are returned unchanged.
    const pastDate = "2000-01-01";
    const slots = ["08:00", "08:30", "09:00", "17:00"];
    const result = filterSameDaySlots(slots, pastDate);
    // Past date != today → no filtering applied
    expect(result).toEqual(slots);
  });

  it("returns all slots for a clearly future date", () => {
    const slots = ["08:00", "09:00", "10:00"];
    expect(filterSameDaySlots(slots, "2099-01-01")).toEqual(slots);
  });

  it("handles empty slot list", () => {
    expect(filterSameDaySlots([], "2099-01-01")).toEqual([]);
  });
});

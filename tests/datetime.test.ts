import { describe, expect, it } from "vitest";
import { addClinicDays } from "@/lib/datetime";
import { MAX_ADVANCE_BOOKING_DAYS } from "@/lib/constants";

describe("addClinicDays", () => {
  it("advances past non-leap February into March", () => {
    expect(addClinicDays("2026-02-28", 1)).toBe("2026-03-01");
  });

  it("handles leap-year February 29", () => {
    expect(addClinicDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addClinicDays("2024-02-28", 2)).toBe("2024-03-01");
  });

  it("respects century leap rules (1900 not leap, 2000 leap)", () => {
    expect(addClinicDays("1900-02-28", 1)).toBe("1900-03-01");
    expect(addClinicDays("2000-02-28", 1)).toBe("2000-02-29");
  });

  it("supports subtracting days", () => {
    expect(addClinicDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addClinicDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("computes a real advance-booking window across Feb/March", () => {
    expect(addClinicDays("2026-02-01", MAX_ADVANCE_BOOKING_DAYS)).toBe("2026-03-03");
    expect(addClinicDays("2024-02-01", 30)).toBe("2024-03-02");
  });
});

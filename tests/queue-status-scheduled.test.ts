import { describe, it, expect } from "vitest";
import { isUpcomingBookedCheckin } from "../lib/queue-status";

const TODAY = "2026-11-19";

describe("isUpcomingBookedCheckin", () => {
  it("treats a future pending booking as upcoming", () => {
    expect(
      isUpcomingBookedCheckin(
        { status: "pending", approval_status: "approved", appointment_date: "2026-11-24T09:00:00" },
        TODAY
      )
    ).toBe(true);
  });

  it("treats a booking for today as upcoming (not yet checked in)", () => {
    expect(
      isUpcomingBookedCheckin(
        { status: "pending", approval_status: "approved", appointment_date: "2026-11-19" },
        TODAY
      )
    ).toBe(true);
  });

  it("accepts checked_in bookings that have no queue entry", () => {
    expect(
      isUpcomingBookedCheckin(
        { status: "checked_in", appointment_date: "2026-11-24" },
        TODAY
      )
    ).toBe(true);
  });

  it("does not treat past visits as upcoming", () => {
    expect(
      isUpcomingBookedCheckin(
        { status: "pending", appointment_date: "2026-11-18T09:00:00" },
        TODAY
      )
    ).toBe(false);
  });

  it("does not treat cancelled, completed, no-show or rejected bookings as upcoming", () => {
    for (const status of ["cancelled", "completed", "no_show"]) {
      expect(
        isUpcomingBookedCheckin({ status, appointment_date: "2026-11-24" }, TODAY)
      ).toBe(false);
    }
    expect(
      isUpcomingBookedCheckin(
        { status: "pending", approval_status: "rejected", appointment_date: "2026-11-24" },
        TODAY
      )
    ).toBe(false);
  });

  it("returns false when there is no appointment date", () => {
    expect(isUpcomingBookedCheckin({ status: "pending", appointment_date: null }, TODAY)).toBe(false);
  });
});

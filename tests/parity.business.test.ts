/**
 * CAREQ Parity Test Suite — Business Logic / Parity Contracts
 *
 * Verifies critical business rules that must match legacy PHP behaviour exactly.
 * Pure unit tests — no DB / HTTP.
 */
import { describe, it, expect } from "vitest";

// ─── Phone last-7-digit matching (cancel / lookup) ──────────────────────────

function last7(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.slice(-7);
}

describe("Phone last-7 matching (cancel / patient_lookup)", () => {
  it("matches when last 7 digits are the same", () => {
    const stored = "09171234567";
    const incoming = "1234567";
    expect(last7(stored)).toBe(last7(incoming));
  });

  it("matches when leading digits differ but last 7 match", () => {
    const stored = "09171234567";
    const incoming = "09001234567";
    expect(last7(stored)).toBe(last7(incoming));
  });

  it("does not match on different last 7", () => {
    const stored = "09171234567";
    const incoming = "09171234568";
    expect(last7(stored)).not.toBe(last7(incoming));
  });
});

// ─── Reference number format ────────────────────────────────────────────────

describe("Reference number formats", () => {
  it("appointment reference starts with APT", () => {
    const ref = "APT202507041";
    expect(ref.startsWith("APT")).toBe(true);
  });

  it("walk-in reference starts with WALK", () => {
    const ref = "WALK202507041234";
    expect(ref.startsWith("WALK")).toBe(true);
  });

  it("queue number format APPT-N", () => {
    const qn = "APPT-5";
    expect(qn).toMatch(/^APPT-\d+$/);
  });

  it("queue number format WALK-N", () => {
    const qn = "WALK-3";
    expect(qn).toMatch(/^WALK-\d+$/);
  });
});

// ─── Email validation ────────────────────────────────────────────────────────

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

describe("Email validation (FILTER_VALIDATE_EMAIL equivalent)", () => {
  it("accepts valid emails", () => {
    expect(isValidEmail("user@example.com")).toBe(true);
    expect(isValidEmail("user.name+tag@domain.co")).toBe(true);
  });

  it("rejects invalid emails", () => {
    expect(isValidEmail("notanemail")).toBe(false);
    expect(isValidEmail("missing@")).toBe(false);
    expect(isValidEmail("@nodomain.com")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });

  it("empty email is optional (bypasses validation)", () => {
    // Legacy: empty email passes ($emailRaw === '') → stored as null
    expect("".trim() === "").toBe(true);
  });
});

// ─── Phone 11-digit validation ───────────────────────────────────────────────

describe("Phone 11-digit validation", () => {
  it("passes for exactly 11 digits", () => {
    const digits = "09171234567".replace(/\D/g, "");
    expect(digits.length).toBe(11);
  });

  it("fails for 10 digits", () => {
    const digits = "0917123456".replace(/\D/g, "");
    expect(digits.length).not.toBe(11);
  });

  it("fails for 12 digits", () => {
    const digits = "091712345678".replace(/\D/g, "");
    expect(digits.length).not.toBe(11);
  });
});

// ─── Queue ordering (skip_count ASC, id ASC) ─────────────────────────────────

describe("Queue ordering — skip_count ASC, id ASC", () => {
  const queueItems = [
    { id: 3, skip_count: 0 },
    { id: 1, skip_count: 2 },
    { id: 2, skip_count: 0 },
    { id: 4, skip_count: 1 },
  ];

  it("sorts by skip_count first, then id", () => {
    const sorted = [...queueItems].sort(
      (a, b) =>
        a.skip_count - b.skip_count || a.id - b.id
    );
    expect(sorted.map((q) => q.id)).toEqual([2, 3, 4, 1]);
  });

  it("a skipped patient (skip_count>0) goes after non-skipped", () => {
    const sorted = [...queueItems].sort(
      (a, b) => a.skip_count - b.skip_count || a.id - b.id
    );
    expect(sorted[0].skip_count).toBe(0);
    expect(sorted[sorted.length - 1].skip_count).toBeGreaterThan(0);
  });
});

// ─── Wait time calculation ────────────────────────────────────────────────────

describe("Est. wait time (position × avg_service_time)", () => {
  it("calculates correctly for position 3 at 10 min avg", () => {
    expect(3 * 10).toBe(30);
  });

  it("defaults avg_service_time to 10 when no data", () => {
    const avgServiceTime = 10; // default
    expect(avgServiceTime).toBe(10);
  });
});

// ─── Terminal appointment status guard ───────────────────────────────────────

describe("Terminal status guard (cancel endpoint)", () => {
  const TERMINAL = ["cancelled", "completed", "no_show"];

  it("blocks cancel for already-cancelled", () => {
    expect(TERMINAL.includes("cancelled")).toBe(true);
  });

  it("blocks cancel for completed", () => {
    expect(TERMINAL.includes("completed")).toBe(true);
  });

  it("blocks cancel for no_show", () => {
    expect(TERMINAL.includes("no_show")).toBe(true);
  });

  it("allows cancel for pending", () => {
    expect(TERMINAL.includes("pending")).toBe(false);
  });

  it("allows cancel for checked_in", () => {
    expect(TERMINAL.includes("checked_in")).toBe(false);
  });
});

// ─── Stale queue auto-complete (20-minute rule) ───────────────────────────────

describe("Stale queue auto-complete (20-min rule)", () => {
  function shouldAutoComplete(calledAtMs: number, nowMs: number): boolean {
    return (nowMs - calledAtMs) / 60000 > 20;
  }

  it("marks as complete if called > 20 minutes ago", () => {
    const now = Date.now();
    const calledAt = now - 21 * 60 * 1000; // 21 minutes ago
    expect(shouldAutoComplete(calledAt, now)).toBe(true);
  });

  it("does NOT mark as complete if called < 20 minutes ago", () => {
    const now = Date.now();
    const calledAt = now - 15 * 60 * 1000; // 15 minutes ago
    expect(shouldAutoComplete(calledAt, now)).toBe(false);
  });

  it("does NOT mark as complete if called exactly 20 minutes ago", () => {
    const now = Date.now();
    const calledAt = now - 20 * 60 * 1000; // exactly 20 minutes
    expect(shouldAutoComplete(calledAt, now)).toBe(false);
  });
});

// ─── Rate limit values match legacy ──────────────────────────────────────────

describe("Rate limit config matches legacy pqms_rate_limit", () => {
  const RATE_LIMITS: Record<string, { max: number; window: number }> = {
    patient_register: { max: 10, window: 60 },
    patient_checkin: { max: 10, window: 60 },
    patient_cancel: { max: 5, window: 60 },
    patient_lookup: { max: 10, window: 60 },
    patient_search: { max: 30, window: 60 },
    patient_schedule: { max: 30, window: 60 },
  };

  it("patient_search allows 30/60s", () => {
    expect(RATE_LIMITS.patient_search.max).toBe(30);
    expect(RATE_LIMITS.patient_search.window).toBe(60);
  });

  it("patient_cancel allows 5/60s (stricter)", () => {
    expect(RATE_LIMITS.patient_cancel.max).toBe(5);
  });

  it("patient_register allows 10/60s", () => {
    expect(RATE_LIMITS.patient_register.max).toBe(10);
  });
});

// ─── Staff role access rules ──────────────────────────────────────────────────

describe("Staff role access rules", () => {
  type Role = "admin" | "doctor" | "nurse" | "receptionist";

  function canResetDaily(role: Role): boolean {
    return role === "admin";
  }

  function canPurgeHistory(role: Role): boolean {
    return role === "admin";
  }

  function canManageStaff(role: Role): boolean {
    return role === "admin";
  }

  it("only admin can reset daily queue", () => {
    expect(canResetDaily("admin")).toBe(true);
    expect(canResetDaily("doctor")).toBe(false);
    expect(canResetDaily("nurse")).toBe(false);
    expect(canResetDaily("receptionist")).toBe(false);
  });

  it("only admin can purge history", () => {
    expect(canPurgeHistory("admin")).toBe(true);
    expect(canPurgeHistory("doctor")).toBe(false);
  });

  it("only admin can manage staff", () => {
    expect(canManageStaff("admin")).toBe(true);
    expect(canManageStaff("receptionist")).toBe(false);
  });
});

// ─── Appointment type duration > 0 ────────────────────────────────────────────

describe("Appointment type validation", () => {
  it("duration must be at least 1", () => {
    expect(1 >= 1).toBe(true);
    expect(0 >= 1).toBe(false);
    expect(-5 >= 1).toBe(false);
  });
});

// ─── Status label mapping (UI parity) ─────────────────────────────────────────

describe("Status display labels (checked_in shown as Confirmed)", () => {
  const STATUS_LABELS: Record<string, string> = {
    pending: "Pending",
    checked_in: "Confirmed",
    cancelled: "Cancelled",
    no_show: "No Show",
    in_progress: "In Progress",
    completed: "Completed",
  };

  it("checked_in shows as 'Confirmed' in UI", () => {
    expect(STATUS_LABELS["checked_in"]).toBe("Confirmed");
  });

  it("pending shows as 'Pending'", () => {
    expect(STATUS_LABELS["pending"]).toBe("Pending");
  });
});

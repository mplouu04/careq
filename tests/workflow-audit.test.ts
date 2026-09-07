/**
 * Workflow / integration-style tests for audit remediation paths.
 * Uses mocked Supabase admin client (no live DB required).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/services/queue-notify.service", () => ({
  notifyPatientCalled: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/datetime", () => ({
  getClinicTodayYmd: () => "2026-06-06",
  getClinicDayStartIso: (ymd: string) => `${ymd}T16:00:00.000Z`,
  addClinicDays: (ymd: string, amount: number) => {
    const d = new Date(`${ymd}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + amount);
    return d.toISOString().slice(0, 10);
  },
}));

vi.mock("@/lib/slots-availability", () => ({
  getDoctorAvailableSlots: vi.fn().mockResolvedValue(["09:00", "09:30", "10:00"]),
}));

function chain(resolved: { data?: unknown; error?: unknown; count?: number }) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const m of [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "neq",
    "in",
    "not",
    "or",
    "gte",
    "lte",
    "lt",
    "gt",
    "order",
    "limit",
    "maybeSingle",
    "single",
  ]) {
    builder[m] = vi.fn(self);
  }
  builder.then = (resolve: (v: unknown) => void) => {
    resolve(resolved);
    return Promise.resolve(resolved);
  };
  return builder;
}

describe("staffUpdateAppointment transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  it("rejects confirm when appointment is already completed", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [], error: null }));

    const { staffUpdateAppointment } = await import("../lib/services/appointment.service");
    const result = await staffUpdateAppointment({
      checkinId: 10,
      status: "confirm",
      userId: "admin-1",
      ip: "127.0.0.1",
    });

    expect(result).toEqual({
      error: "Appointment cannot be updated from its current status",
      status: 409,
    });
  });

  it("confirms pending appointment to checked_in", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [{ checkin_id: 10 }], error: null }));

    const { staffUpdateAppointment } = await import("../lib/services/appointment.service");
    const result = await staffUpdateAppointment({
      checkinId: 10,
      status: "confirm",
      userId: "admin-1",
      ip: "127.0.0.1",
    });

    expect(result).toEqual({ success: true, status: "checked_in" });
  });

  it("allows cancel from checked_in", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: [{ checkin_id: 11 }], error: null }));

    const { staffUpdateAppointment } = await import("../lib/services/appointment.service");
    const result = await staffUpdateAppointment({
      checkinId: 11,
      status: "cancel",
      userId: "admin-1",
      ip: "127.0.0.1",
    });

    expect(result).toEqual({ success: true, status: "cancelled" });
  });
});

describe("checkinToQueue retry limit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockReset();
  });

  it("retries unique violations up to 3 times then fails", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate" } })
      .mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate" } })
      .mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate" } });

    const { checkinToQueue } = await import("../lib/counters");
    await expect(checkinToQueue(1, "APPT")).rejects.toMatchObject({
      name: "CheckinError",
      status: 409,
    });
    expect(mockRpc).toHaveBeenCalledTimes(3);
  });

  it("succeeds on a later attempt after unique collision", async () => {
    mockRpc
      .mockResolvedValueOnce({ data: null, error: { code: "23505", message: "duplicate" } })
      .mockResolvedValueOnce({ data: "APPT-2", error: null });

    const { checkinToQueue } = await import("../lib/counters");
    await expect(checkinToQueue(1, "APPT")).resolves.toBe("APPT-2");
    expect(mockRpc).toHaveBeenCalledTimes(2);
  });
});

describe("bookAppointment slot locking via RPC", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  it("returns slot_unavailable when book_appointment_slot raises", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: "00000000-0000-4000-8000-000000000001" }, error: null }))
      .mockReturnValueOnce(
        chain({
          data: {
            duration: 30,
            buffer_minutes: 0,
            default_priority: "normal",
            max_concurrent: 1,
          },
          error: null,
        })
      )
      .mockReturnValueOnce(chain({ data: { patient_id: 9 }, error: null }))
      .mockReturnValueOnce(chain({ data: { id: 9, public_id: "pub-9" }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null, count: 0 }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    mockRpc
      .mockResolvedValueOnce({ data: 1, error: null }) // next_counter for reference
      .mockResolvedValueOnce({
        data: null,
        error: { message: "slot_unavailable", code: "P0001" },
      });

    const { bookAppointment } = await import("../lib/services/appointment.service");
    const result = await bookAppointment({
      preferredDoctor: "00000000-0000-4000-8000-000000000001",
      appointmentType: 1,
      appointmentDate: "2026-06-10",
      appointmentTime: "09:00",
      termsAgreement: true,
      verifyToken: "550e8400-e29b-41d4-a716-446655440099",
    });

    expect(result).toMatchObject({
      status: 409,
      code: "slot_unavailable",
    });
    expect(mockRpc).toHaveBeenCalledWith(
      "book_appointment_slot",
      expect.objectContaining({
        p_scheduled_time: "09:00",
        p_max_concurrent: 1,
      })
    );
  });
});

describe("DoctorAdminActionSchema", () => {
  it("accepts bulk schedule upsert without action field", async () => {
    const { DoctorAdminActionSchema } = await import("../lib/schemas/admin");
    const parsed = DoctorAdminActionSchema.safeParse({
      type: "schedule",
      doctorId: "00000000-0000-4000-8000-000000000001",
      schedules: [
        { day_of_week: 1, is_active: true, start_time: "08:00", end_time: "17:00" },
      ],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect("schedules" in parsed.data).toBe(true);
    }
  });

  it("rejects invalid time format", async () => {
    const { DoctorAdminActionSchema } = await import("../lib/schemas/admin");
    const parsed = DoctorAdminActionSchema.safeParse({
      type: "schedule",
      doctorId: "00000000-0000-4000-8000-000000000001",
      schedules: [
        { day_of_week: 1, is_active: true, start_time: "8:00", end_time: "17:00" },
      ],
    });
    expect(parsed.success).toBe(false);
  });
});

describe("queue command helpers", () => {
  it("parseQueueIdParam rejects invalid ids", async () => {
    const { parseQueueIdParam } = await import("../lib/api/queue-commands");
    const bad = parseQueueIdParam({ id: "abc" });
    expect("error" in bad).toBe(true);

    const good = parseQueueIdParam({ id: "42" });
    expect(good).toEqual({ queueId: 42 });
  });
});

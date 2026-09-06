/**
 * Service layer unit tests with mocked Supabase admin client.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

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

vi.mock("@/lib/staff-metadata", () => ({
  syncStaffMetadata: vi.fn().mockResolvedValue(undefined),
}));

const mockBroadcastDoctorsChanged = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/supabase/broadcast", () => ({
  broadcastDoctorsChanged: mockBroadcastDoctorsChanged,
  broadcastRealtime: vi.fn().mockResolvedValue({ ok: true }),
  DOCTORS_BROADCAST_TOPIC: "doctors:changes",
  DOCTORS_BROADCAST_EVENT: "changed",
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

describe("appointment.service cancelAppointment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  it("returns 404 when appointment not found", async () => {
    mockFrom.mockReturnValue(chain({ data: null }));

    const { cancelAppointment } = await import("../lib/services/appointment.service");
    const result = await cancelAppointment("APT-MISSING", "09171234567");

    expect(result).toEqual({ error: "Appointment not found", status: 404 });
  });

  it("returns 403 when phone does not match", async () => {
    mockFrom.mockReturnValue(
      chain({
        data: {
          checkin_id: 1,
          status: "pending",
          patients: { phone: "09171234567", phone_normalized: "09171234567" },
        },
      })
    );

    const { cancelAppointment } = await import("../lib/services/appointment.service");
    const result = await cancelAppointment("APT20260610001", "09999999999");

    expect(result).toEqual({ error: "Phone number does not match.", status: 403 });
  });

  it("cancels by reference when phone verified at cancel time (reference lookup flow)", async () => {
    mockFrom
      .mockReturnValueOnce(
        chain({
          data: {
            checkin_id: 1,
            status: "pending",
            patients: { phone: "09171234567", phone_normalized: "09171234567" },
          },
        })
      )
      .mockReturnValueOnce(chain({ data: { checkin_id: 1 }, error: null }));

    const { cancelAppointment } = await import("../lib/services/appointment.service");
    const result = await cancelAppointment("APT20260610001", "1234567");

    expect(result).toEqual({ success: true });
  });

  it("returns 409 when concurrent status change prevents cancel", async () => {
    mockFrom
      .mockReturnValueOnce(
        chain({
          data: {
            checkin_id: 1,
            status: "pending",
            patients: { phone: "09171234567", phone_normalized: "09171234567" },
          },
        })
      )
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const { cancelAppointment } = await import("../lib/services/appointment.service");
    const result = await cancelAppointment("APT20260610001", "09171234567");

    expect(result).toEqual({
      error: "This appointment cannot be cancelled.",
      status: 409,
    });
  });
});

describe("appointment.service lookupPatientAppointments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  it("returns appointments when last 7 digits match", async () => {
    mockFrom
      .mockReturnValueOnce(
        chain({
          data: [
            {
              id: "p1",
              public_id: "550e8400-e29b-41d4-a716-446655440001",
              first_name: "Jane",
              last_name: "Doe",
              phone: "09171234567",
              phone_normalized: "09171234567",
            },
            {
              id: "p2",
              public_id: "550e8400-e29b-41d4-a716-446655440002",
              first_name: "Other",
              last_name: "Person",
              phone: "09998887777",
              phone_normalized: "09998887777",
            },
          ],
        })
      )
      .mockReturnValueOnce(
        chain({
          data: [
            {
              checkin_id: 10,
              reference_number: "APT20260610001",
              scheduled_time: "09:00:00",
              appointment_date: "2026-06-10T09:00:00",
              status: "pending",
              reason: null,
              appointment_types: { name: "Consultation" },
              staff: { first_name: "John", last_name: "Smith" },
            },
          ],
        })
      );

    const { lookupPatientAppointments } = await import("../lib/services/appointment.service");
    const result = await lookupPatientAppointments("1234567", "1990-01-01");

    expect(result.publicId).toBe("550e8400-e29b-41d4-a716-446655440001");
    expect(result.patientName).toBe("Jane Doe");
    expect(result.appointments).toHaveLength(1);
    expect(result.appointments[0].reference).toBe("APT20260610001");
  });

  it("returns empty when last 7 digits do not match any patient with DOB", async () => {
    mockFrom.mockReturnValueOnce(
      chain({
        data: [
            {
              id: "p1",
              public_id: "550e8400-e29b-41d4-a716-446655440001",
              first_name: "Jane",
              last_name: "Doe",
              phone: "09171234567",
              phone_normalized: "09171234567",
            },
        ],
      })
    );

    const { lookupPatientAppointments } = await import("../lib/services/appointment.service");
    const result = await lookupPatientAppointments("9999999", "1990-01-01");

    expect(result).toEqual({ appointments: [], publicId: null, patientName: "" });
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

describe("isActiveAppointmentForLookup", () => {
  it("always includes pending appointments", async () => {
    const { isActiveAppointmentForLookup } = await import("../lib/services/appointment.service");
    expect(
      isActiveAppointmentForLookup("pending", "2020-01-01T00:00:00.000Z", "2026-06-25T00:00:00.000Z")
    ).toBe(true);
  });

  it("includes non-pending appointments from today onward", async () => {
    const { isActiveAppointmentForLookup } = await import("../lib/services/appointment.service");
    const todayStart = "2026-06-25T08:00:00.000Z";
    expect(isActiveAppointmentForLookup("checked_in", "2026-06-25T09:00:00.000Z", todayStart)).toBe(
      true
    );
    expect(isActiveAppointmentForLookup("checked_in", "2026-06-24T09:00:00.000Z", todayStart)).toBe(
      false
    );
  });
});

describe("appointment.service lookupAppointmentByReference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  function mockCheckinAndPatient(
    checkin: Record<string, unknown>,
    patient: Record<string, unknown> | null
  ) {
    mockFrom.mockReturnValueOnce(
      chain({ data: { ...checkin, patients: patient } })
    );
  }

  it("returns empty when reference not found", async () => {
    mockFrom.mockReturnValue(chain({ data: null }));

    const { lookupAppointmentByReference } = await import("../lib/services/appointment.service");
    const result = await lookupAppointmentByReference("APT-MISSING", "09171234567");

    expect(result).toEqual({ appointments: [], publicId: null, patientName: "" });
  });

  it("returns empty when phone does not match", async () => {
    mockCheckinAndPatient(
      {
        checkin_id: 10,
        reference_number: "APT20260610001",
        scheduled_time: "09:00:00",
        appointment_date: "2026-06-10T09:00:00",
        status: "pending",
        reason: "Follow-up",
        patient_id: 42,
        appointment_types: { name: "Consultation" },
        staff: { first_name: "John", last_name: "Smith" },
      },
      {
        first_name: "Jane",
        last_name: "Doe",
        public_id: "550e8400-e29b-41d4-a716-446655440099",
        phone: "09171234567",
        phone_normalized: "09171234567",
      }
    );

    const { lookupAppointmentByReference } = await import("../lib/services/appointment.service");
    const result = await lookupAppointmentByReference("APT20260610001", "09999999999");

    expect(result).toEqual({ appointments: [], publicId: null, patientName: "" });
  });

  it("returns appointment when reference and phone match", async () => {
    mockCheckinAndPatient(
      {
        checkin_id: 10,
        reference_number: "APT20260610001",
        scheduled_time: "09:00:00",
        appointment_date: "2026-06-10T09:00:00",
        status: "pending",
        reason: "Follow-up",
        patient_id: 42,
        appointment_types: { name: "Consultation" },
        staff: { first_name: "John", last_name: "Smith" },
      },
      {
        first_name: "Jane",
        last_name: "Doe",
        public_id: "550e8400-e29b-41d4-a716-446655440099",
        phone: "09171234567",
        phone_normalized: "09171234567",
      }
    );

    const { lookupAppointmentByReference } = await import("../lib/services/appointment.service");
    const result = await lookupAppointmentByReference("apt20260610001", "1234567");

    expect(result.publicId).toBe("550e8400-e29b-41d4-a716-446655440099");
    expect(result.patientName).toBe("Jane Doe");
    expect(result.appointments[0].reference).toBe("APT20260610001");
  });

  it("loads patient from patients table by patient_id", async () => {
    mockCheckinAndPatient(
      {
        checkin_id: 10,
        reference_number: "APT202606297",
        scheduled_time: "09:00:00",
        appointment_date: "2026-06-29T09:00:00",
        status: "checked_in",
        reason: null,
        patient_id: 42,
        appointment_types: { name: "Consultation" },
        staff: { first_name: "John", last_name: "Smith" },
      },
      {
        first_name: "Marlou",
        last_name: "Paris",
        public_id: "550e8400-e29b-41d4-a716-446655440099",
        phone: "09502994754",
        phone_normalized: "09502994754",
      }
    );

    const { lookupAppointmentByReference } = await import("../lib/services/appointment.service");
    const result = await lookupAppointmentByReference("APT202606297", "09502994754");

    expect(result.patientName).toBe("Marlou Paris");
    expect(result.appointments).toHaveLength(1);
    expect(result.appointments[0].status).toBe("checked_in");
  });

  it("matches full local phone when stored without leading zero", async () => {
    mockCheckinAndPatient(
      {
        checkin_id: 10,
        reference_number: "APT202606297",
        scheduled_time: "09:00:00",
        appointment_date: "2026-06-29T09:00:00",
        status: "pending",
        reason: null,
        patient_id: 42,
        appointment_types: { name: "Consultation" },
        staff: { first_name: "John", last_name: "Smith" },
      },
      {
        first_name: "Jane",
        last_name: "Doe",
        public_id: "550e8400-e29b-41d4-a716-446655440099",
        phone: "9502994754",
        phone_normalized: "9502994754",
      }
    );

    const { lookupAppointmentByReference } = await import("../lib/services/appointment.service");
    const result = await lookupAppointmentByReference("APT202606297", "09502994754");

    expect(result.appointments).toHaveLength(1);
  });
});

describe("queue.service callNextPatient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  it("returns success when queue row updated", async () => {
    mockFrom.mockReturnValue(chain({ data: { id: 1 }, error: null }));

    const { callNextPatient } = await import("../lib/services/queue.service");
    const result = await callNextPatient({
      queueId: 1,
      doctorId: "550e8400-e29b-41d4-a716-446655440000",
      roomNumber: 2,
      userId: "user-1",
      ip: "127.0.0.1",
    });

    expect(result).toEqual({ success: true });
  });

  it("returns 500 when update fails", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: { message: "fail" } }));

    const { callNextPatient } = await import("../lib/services/queue.service");
    const result = await callNextPatient({
      queueId: 99,
      doctorId: "550e8400-e29b-41d4-a716-446655440000",
      roomNumber: 1,
      userId: "user-1",
      ip: "127.0.0.1",
    });

    expect(result).toEqual({ error: "Failed to call patient", status: 500 });
  });

  it("returns 409 when patient is already called", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: { message: "stale" } }))
      .mockReturnValueOnce(chain({ data: { status: "in_progress" }, error: null }));

    const { callNextPatient } = await import("../lib/services/queue.service");
    const result = await callNextPatient({
      queueId: 7,
      doctorId: "550e8400-e29b-41d4-a716-446655440000",
      roomNumber: 1,
      userId: "user-1",
      ip: "127.0.0.1",
    });

    expect(result).toEqual({ error: "Already called", status: 409 });
  });

  it("returns 409 when queue entry is not waiting", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: { message: "stale" } }))
      .mockReturnValueOnce(chain({ data: { status: "completed" }, error: null }));

    const { callNextPatient } = await import("../lib/services/queue.service");
    const result = await callNextPatient({
      queueId: 8,
      doctorId: "550e8400-e29b-41d4-a716-446655440000",
      roomNumber: 1,
      userId: "user-1",
      ip: "127.0.0.1",
    });

    expect(result).toEqual({ error: "Queue entry is already completed", status: 409 });
  });
});

describe("queue.service recallPatient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  it("returns 409 when recall target is already called", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: { message: "stale" } }))
      .mockReturnValueOnce(chain({ data: { status: "called" }, error: null }));

    const { recallPatient } = await import("../lib/services/queue.service");
    const result = await recallPatient({
      queueId: 11,
      doctorId: "550e8400-e29b-41d4-a716-446655440000",
      roomNumber: 2,
      userId: "user-1",
      ip: "127.0.0.1",
    });

    expect(result).toEqual({ error: "Already called", status: 409 });
  });

  it("returns 409 when recall target is not waiting", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: { message: "stale" } }))
      .mockReturnValueOnce(chain({ data: { status: "cancelled" }, error: null }));

    const { recallPatient } = await import("../lib/services/queue.service");
    const result = await recallPatient({
      queueId: 12,
      doctorId: "550e8400-e29b-41d4-a716-446655440000",
      roomNumber: 2,
      userId: "user-1",
      ip: "127.0.0.1",
    });

    expect(result).toEqual({ error: "Queue entry is already cancelled", status: 409 });
  });
});

describe("queue.service markNoShow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  it("marks waiting queue entry and linked checkin as no_show", async () => {
    mockFrom
      .mockReturnValueOnce(
        chain({ data: { id: 1, status: "waiting", checkin_id: 42 }, error: null })
      )
      .mockReturnValueOnce(chain({ data: { id: 1 }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const { markNoShow } = await import("../lib/services/queue.service");
    const result = await markNoShow({ queueId: 1, userId: "user-1", ip: "127.0.0.1" });

    expect(result).toMatchObject({ success: true });
    const tables = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(tables).toContain("checkins");
  });

  it("returns 409 when concurrent status change prevents no-show", async () => {
    mockFrom
      .mockReturnValueOnce(
        chain({ data: { id: 1, status: "waiting", checkin_id: 42 }, error: null })
      )
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const { markNoShow } = await import("../lib/services/queue.service");
    const result = await markNoShow({ queueId: 1, userId: "user-1", ip: "127.0.0.1" });

    expect(result).toEqual({
      error: "Only waiting or in-progress patients can be marked no-show",
      status: 409,
    });
  });

  it("returns 400 when status is already terminal", async () => {
    mockFrom.mockReturnValueOnce(
      chain({ data: { id: 1, status: "completed", checkin_id: 42 }, error: null })
    );

    const { markNoShow } = await import("../lib/services/queue.service");
    const result = await markNoShow({ queueId: 1, userId: "user-1", ip: "127.0.0.1" });

    expect(result).toEqual({
      error: "Only waiting or in-progress patients can be marked no-show",
      status: 400,
    });
  });
});

describe("queue.service markDone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  it("updates queue and linked checkin to completed", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: 1, checkin_id: 42 }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const { markDone } = await import("../lib/services/queue.service");
    const result = await markDone({ queueId: 1, userId: "user-1", ip: "127.0.0.1" });

    expect(result).toEqual({ success: true });
    const tables = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(tables).toContain("checkins");
  });

  it("returns 409 when queue row is not in_progress", async () => {
    mockFrom.mockReturnValueOnce(chain({ data: null, error: null }));

    const { markDone } = await import("../lib/services/queue.service");
    const result = await markDone({ queueId: 99, userId: "user-1", ip: "127.0.0.1" });

    expect(result).toEqual({
      error: "Queue entry is not in progress",
      status: 409,
    });
    const tables = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(tables).not.toContain("checkins");
  });

  it("skips checkin update when checkin_id is null", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: 1, checkin_id: null }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const { markDone } = await import("../lib/services/queue.service");
    const result = await markDone({ queueId: 1, userId: "user-1", ip: "127.0.0.1" });

    expect(result).toEqual({ success: true });
    const tables = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(tables).not.toContain("checkins");
  });

  it("returns 500 when queue update errors", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: { id: 1, checkin_id: 5 }, error: null }))
      .mockReturnValueOnce(chain({ data: null, error: { message: "db error" } }));

    const { markDone } = await import("../lib/services/queue.service");
    const result = await markDone({ queueId: 1, userId: "user-1", ip: "127.0.0.1" });

    expect(result).toEqual({ error: "Failed to mark done", status: 500 });
    const tables = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(tables).not.toContain("checkins");
  });
});

describe("queue.service completeQueueEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  it("returns 0 immediately for empty ids array without touching DB", async () => {
    const { completeQueueEntries } = await import("../lib/services/queue.service");
    const count = await completeQueueEntries([]);

    expect(count).toBe(0);
    expect(mockFrom).not.toHaveBeenCalled();
  });

  it("marks queue rows and linked checkins completed", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [{ checkin_id: 10 }, { checkin_id: 20 }] }))
      .mockReturnValueOnce(chain({ data: [{ id: 1 }, { id: 2 }] }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const { completeQueueEntries } = await import("../lib/services/queue.service");
    const count = await completeQueueEntries([1, 2]);

    expect(count).toBe(2);
    const tables = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(tables).toContain("checkins");
  });

  it("skips checkins update when all checkin_ids are null", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [{ checkin_id: null }, { checkin_id: null }] }))
      .mockReturnValueOnce(chain({ data: [{ id: 1 }, { id: 2 }] }));

    const { completeQueueEntries } = await import("../lib/services/queue.service");
    const count = await completeQueueEntries([1, 2]);

    expect(count).toBe(2);
    const tables = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(tables).not.toContain("checkins");
  });

  it("only syncs checkins with non-null ids (mixed case)", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: [{ checkin_id: 5 }, { checkin_id: null }] }))
      .mockReturnValueOnce(chain({ data: [{ id: 1 }, { id: 2 }] }))
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const { completeQueueEntries } = await import("../lib/services/queue.service");
    const count = await completeQueueEntries([1, 2]);

    expect(count).toBe(2);
    const tables = mockFrom.mock.calls.map((c: unknown[]) => c[0]);
    expect(tables).toContain("checkins");
  });
});

describe("patient.service verifyPatientByDobAndPhone", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  it("returns matched false when no patient matches DOB and phone", async () => {
    mockFrom.mockReturnValue(chain({ data: [] }));

    const { verifyPatientByDobAndPhone } = await import(
      "../lib/services/patient.service"
    );
    const result = await verifyPatientByDobAndPhone("1990-01-01", "1234567");

    expect(result).toEqual({ matched: false });
  });

  it("returns firstName and verifyToken when DOB and last 7 digits match", async () => {
    mockFrom
      .mockReturnValueOnce(
        chain({
          data: [
            {
              id: 42,
              first_name: "John",
              phone: "09171234567",
              phone_normalized: "09171234567",
            },
          ],
        })
      )
      .mockReturnValueOnce(
        chain({
          data: { token: "550e8400-e29b-41d4-a716-446655440000" },
          error: null,
        })
      );

    const { verifyPatientByDobAndPhone } = await import(
      "../lib/services/patient.service"
    );
    const result = await verifyPatientByDobAndPhone(
      "1990-01-01",
      "1234567",
      "127.0.0.1"
    );

    expect(result).toEqual({
      matched: true,
      firstName: "John",
      verifyToken: "550e8400-e29b-41d4-a716-446655440000",
    });
  });

  it("filters patients by phonesMatchLast7", async () => {
    mockFrom
      .mockReturnValueOnce(
        chain({
          data: [
            {
              id: 1,
              first_name: "Wrong",
              phone: "09179999999",
              phone_normalized: "09179999999",
            },
            {
              id: 2,
              first_name: "Jane",
              phone: "09171234567",
              phone_normalized: "09171234567",
            },
          ],
        })
      )
      .mockReturnValueOnce(
        chain({
          data: { token: "session-token-uuid" },
          error: null,
        })
      );

    const { verifyPatientByDobAndPhone } = await import(
      "../lib/services/patient.service"
    );
    const result = await verifyPatientByDobAndPhone("1985-05-05", "1234567");

    expect(result).toEqual({
      matched: true,
      firstName: "Jane",
      verifyToken: "session-token-uuid",
    });
  });
});

describe("patient.service consumePatientVerifyToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  it("returns patient_id and marks token used when valid", async () => {
    mockFrom.mockReturnValue(
      chain({
        data: { patient_id: 42 },
        error: null,
      })
    );

    const { consumePatientVerifyToken } = await import(
      "../lib/services/patient.service"
    );
    const patientId = await consumePatientVerifyToken(
      "550e8400-e29b-41d4-a716-446655440000"
    );

    expect(patientId).toBe(42);
    expect(mockFrom).toHaveBeenCalledWith("patient_sessions");
  });

  it("throws 403 when token is invalid, expired, or already used", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));

    const { consumePatientVerifyToken } = await import(
      "../lib/services/patient.service"
    );

    await expect(
      consumePatientVerifyToken("550e8400-e29b-41d4-a716-446655440000")
    ).rejects.toMatchObject({
      message: "Invalid or expired verification token",
      status: 403,
    });
  });
});

describe("checkin.service checkinAppointment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ data: 12, error: null });
  });

  it("throws 404 when appointment not found", async () => {
    mockFrom.mockReturnValue(chain({ data: null }));

    const { checkinAppointment } = await import("../lib/services/checkin.service");
    await expect(checkinAppointment("APT-MISSING", "09171234567")).rejects.toMatchObject({
      message: "Appointment not found",
      status: 404,
    });
  });

  it("throws 403 when phone does not match", async () => {
    mockFrom.mockReturnValue(
      chain({
        data: {
          checkin_id: 1,
          status: "pending",
          patients: { phone: "09171234567", phone_normalized: "09171234567" },
        },
      })
    );

    const { checkinAppointment } = await import("../lib/services/checkin.service");
    await expect(checkinAppointment("APT20260610001", "09999999999")).rejects.toMatchObject({
      message: "Phone number does not match.",
      status: 403,
    });
  });

  it("checks in when phone matches", async () => {
    mockFrom.mockReturnValue(
      chain({
        data: {
          checkin_id: 1,
          status: "pending",
          patients: { phone: "09171234567", phone_normalized: "09171234567" },
        },
      })
    );

    const { checkinAppointment } = await import("../lib/services/checkin.service");
    const result = await checkinAppointment("APT20260610001", "1234567");

    expect(result.queueNumber).toBe(12);
    expect(mockRpc).toHaveBeenCalled();
  });
});

describe("checkin.service checkinWalkIn", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
    mockRpc.mockResolvedValue({ data: 1, error: null });
  });

  it("resolves patient from verifyToken and creates walk-in checkin", async () => {
    mockFrom
      .mockReturnValueOnce(
        chain({
          data: { patient_id: 7 },
          error: null,
        })
      )
      .mockReturnValueOnce(
        chain({
          data: { checkin_id: 99 },
          error: null,
        })
      )
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const { checkinWalkIn } = await import("../lib/services/checkin.service");
    const result = await checkinWalkIn({
      verifyToken: "550e8400-e29b-41d4-a716-446655440000",
      appointmentType: 1,
      additionalinfo: "Headache",
      termsAgreement: true,
    });

    expect(result.queueNumber).toBeTruthy();
    expect(result.reference).toMatch(/^WALK/);
  });
});

describe("admin.service toggleStaffActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
    mockBroadcastDoctorsChanged.mockClear();
  });

  it("prevents self-deactivation", async () => {
    const { toggleStaffActive } = await import("../lib/services/admin.service");
    const result = await toggleStaffActive({
      id: "user-1",
      requestingUserId: "user-1",
      ip: "127.0.0.1",
    });

    expect(result).toEqual({
      error: "You cannot deactivate your own account",
      status: 400,
    });
  });

  it("broadcasts doctors-changed when a doctor is deactivated", async () => {
    // Sequenced from(...) calls inside toggleStaffActive:
    //   1) SELECT current row  -> role=doctor, is_active=true
    //   2) UPDATE staff        -> no error
    //   3) SELECT confirmed    -> is_active=false
    let call = 0;
    mockFrom.mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return chain({
          data: {
            is_active: true,
            first_name: "Ana",
            last_name: "Cruz",
            role: "doctor",
          },
        });
      }
      if (call === 2) {
        return chain({ data: null, error: null });
      }
      return chain({ data: { is_active: false } });
    });

    const { toggleStaffActive } = await import("../lib/services/admin.service");
    const result = await toggleStaffActive({
      id: "doc-1",
      requestingUserId: "admin-1",
      ip: "127.0.0.1",
    });

    expect(result).toEqual({ success: true, is_active: false });
    expect(mockBroadcastDoctorsChanged).toHaveBeenCalledTimes(1);
    expect(mockBroadcastDoctorsChanged).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "doc-1",
        is_active: false,
        action: "deactivate",
      })
    );
  });

  it("does not broadcast when a non-doctor staff role is toggled", async () => {
    let call = 0;
    mockFrom.mockImplementation(() => {
      call += 1;
      if (call === 1) {
        return chain({
          data: {
            is_active: true,
            first_name: "Ben",
            last_name: "Reyes",
            role: "receptionist",
          },
        });
      }
      if (call === 2) {
        return chain({ data: null, error: null });
      }
      return chain({ data: { is_active: false } });
    });

    const { toggleStaffActive } = await import("../lib/services/admin.service");
    const result = await toggleStaffActive({
      id: "recep-1",
      requestingUserId: "admin-1",
      ip: "127.0.0.1",
    });

    expect(result).toEqual({ success: true, is_active: false });
    expect(mockBroadcastDoctorsChanged).not.toHaveBeenCalled();
  });
});

describe("queue-metrics getQueueReport", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T12:00:00Z"));
    const { clearAvgServiceTimeCache } = await import("../lib/services/queue-metrics");
    clearAvgServiceTimeCache();
    mockRpc.mockImplementation(async (fn: string) => {
      if (fn === "get_avg_service_minutes") return { data: 10, error: null };
      if (fn === "get_queue_served_by_day") return { data: [], error: null };
      return { data: null, error: null };
    });
    mockFrom.mockReturnValue(chain({ data: null, count: 0 }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("defaults to 7 days of history", async () => {
    const { getQueueReport } = await import("../lib/services/queue-metrics");
    const report = await getQueueReport("2026-06-07T00:00:00Z");

    expect(report.history).toHaveLength(7);
    expect(report.history[0]?.date).toBe("2026-05-31");
    expect(report.history[6]?.date).toBe("2026-06-06");
    expect(report.avg_service_time).toBe(10);
  });

  it("respects custom historyDays parameter", async () => {
    const { getQueueReport } = await import("../lib/services/queue-metrics");
    const report = await getQueueReport("2026-06-07T00:00:00Z", 14);

    expect(report.history).toHaveLength(14);
    expect(report.history[0]?.date).toBe("2026-05-24");
    expect(report.history[13]?.date).toBe("2026-06-06");
  });
});

describe("queue.service getAnalyticsReport", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-07T12:00:00Z"));
    const { clearAvgServiceTimeCache } = await import("../lib/services/queue-metrics");
    clearAvgServiceTimeCache();
    mockRpc.mockImplementation(async (fn: string) => {
      if (fn === "get_avg_service_minutes") return { data: 10, error: null };
      if (fn === "get_queue_served_by_day") return { data: [], error: null };
      return { data: null, error: null };
    });
    mockFrom.mockReturnValue(chain({ data: null, count: 0 }));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("passes days through to getQueueReport", async () => {
    const { getAnalyticsReport } = await import("../lib/services/queue.service");
    const report = await getAnalyticsReport(3);

    expect(report.history).toHaveLength(3);
    expect(report.success).toBe(true);
  });
});

describe("parseJsonBody", () => {
  it("returns parsed data for valid JSON", async () => {
    const { parseJsonBody } = await import("../lib/api/parse-body");
    const { RegisterPatientSchema } = await import("../lib/schemas/patient");

    const request = new Request("http://localhost/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "Test",
        lastName: "User",
        dob: "1990-01-01",
        gender: "male",
        phone: "09171234567",
        address: "123 Test Street",
        consent: true,
      }),
    });

    const result = await parseJsonBody(request, RegisterPatientSchema);
    expect("data" in result).toBe(true);
    if ("data" in result) {
      expect(result.data.firstName).toBe("Test");
    }
  });
});

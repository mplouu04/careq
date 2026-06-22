/**
 * Service layer unit tests with mocked Supabase admin client.
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

vi.mock("@/lib/staff-metadata", () => ({
  syncStaffMetadata: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/datetime", () => ({
  getClinicTodayYmd: () => "2026-06-06",
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
      .mockReturnValueOnce(chain({ data: null, error: null }));

    const { cancelAppointment } = await import("../lib/services/appointment.service");
    const result = await cancelAppointment("APT20260610001", "1234567");

    expect(result).toEqual({ success: true });
  });
});

describe("appointment.service lookupPatientAppointments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns appointments when last 7 digits match", async () => {
    mockFrom
      .mockReturnValueOnce(
        chain({
          data: [
            {
              id: "p1",
              first_name: "Jane",
              last_name: "Doe",
              phone: "09171234567",
              phone_normalized: "09171234567",
            },
            {
              id: "p2",
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

    expect(result.patientId).toBe("p1");
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

    expect(result).toEqual({ appointments: [], patientId: null, patientName: "" });
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});

describe("appointment.service lookupAppointmentByReference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns empty when reference not found", async () => {
    mockFrom.mockReturnValue(chain({ data: null }));

    const { lookupAppointmentByReference } = await import("../lib/services/appointment.service");
    const result = await lookupAppointmentByReference("APT-MISSING");

    expect(result).toEqual({ appointments: [], patientId: null, patientName: "" });
  });

  it("returns a single appointment with patient name for valid reference", async () => {
    mockFrom.mockReturnValue(
      chain({
        data: {
          checkin_id: 10,
          reference_number: "APT20260610001",
          scheduled_time: "09:00:00",
          appointment_date: "2026-06-10T09:00:00",
          status: "pending",
          reason: "Follow-up",
          patient_id: 42,
          appointment_types: { name: "Consultation" },
          staff: { first_name: "John", last_name: "Smith" },
          patients: { first_name: "Jane", last_name: "Doe" },
        },
      })
    );

    const { lookupAppointmentByReference } = await import("../lib/services/appointment.service");
    const result = await lookupAppointmentByReference("APT20260610001");

    expect(result.patientId).toBe("42");
    expect(result.patientName).toBe("Jane Doe");
    expect(result.appointments).toHaveLength(1);
    expect(result.appointments[0]).toMatchObject({
      checkinId: 10,
      reference: "APT20260610001",
      doctor: "Dr. John Smith",
      type: "Consultation",
      reason: "Follow-up",
      status: "pending",
    });
  });
});

describe("queue.service callNextPatient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

describe("admin.service toggleStaffActive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        address: "Test",
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

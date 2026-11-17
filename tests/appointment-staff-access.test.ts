/**
 * Least-privilege staff appointment list (server-side).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "fs";
import path from "path";

const mockFrom = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
    rpc: vi.fn(),
  }),
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
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

function chain(resolved: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const m of [
    "select",
    "eq",
    "not",
    "gte",
    "lte",
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

describe("listStaffAppointments least privilege", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
  });

  it("scopes doctor queries to doctor_id and omits patient phone from select", async () => {
    const builder = chain({
      data: [
        {
          checkin_id: 1,
          reference_number: "APT1",
          doctor_id: "doc-a",
          patients: { first_name: "Ann", last_name: "Lee", phone: "09171111111" },
          staff: { first_name: "Doc", last_name: "A" },
          appointment_types: { name: "Consult" },
          status: "pending",
          approval_status: "approved",
          scheduled_time: "09:00",
          appointment_date: "2026-06-06T01:00:00Z",
          patient_id: 10,
        },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const { listStaffAppointments } = await import(
      "@/lib/services/appointment.service"
    );
    const result = await listStaffAppointments("upcoming", {
      role: "doctor",
      staffId: "doc-a",
    });

    expect(builder.eq).toHaveBeenCalledWith("doctor_id", "doc-a");
    const selectArg = (builder.select as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(selectArg).toContain("patients(first_name, last_name)");
    expect(selectArg).not.toMatch(/patients\([^)]*phone/);

    expect(result.error).toBeNull();
    expect(result.appointments).toHaveLength(1);
    const row = result.appointments[0] as {
      patients: { first_name: string; last_name: string; phone?: string };
    };
    expect(row.patients.first_name).toBe("Ann");
    expect(row.patients).not.toHaveProperty("phone");
  });

  it("does not scope receptionist queries by doctor_id and keeps phone for ops", async () => {
    const builder = chain({
      data: [
        {
          checkin_id: 2,
          reference_number: "APT2",
          doctor_id: "doc-b",
          patients: { first_name: "Bob", last_name: "Ng", phone: "09172222222" },
          staff: { first_name: "Doc", last_name: "B" },
          appointment_types: { name: "Consult" },
          status: "pending",
          approval_status: "pending",
          scheduled_time: "10:00",
          appointment_date: "2026-06-06T02:00:00Z",
          patient_id: 11,
        },
      ],
      error: null,
    });
    mockFrom.mockReturnValue(builder);

    const { listStaffAppointments } = await import(
      "@/lib/services/appointment.service"
    );
    const result = await listStaffAppointments("upcoming", {
      role: "receptionist",
      staffId: "recv-1",
    });

    const eqCalls = (builder.eq as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0]
    );
    expect(eqCalls).not.toContain("doctor_id");
    const selectArg = (builder.select as ReturnType<typeof vi.fn>).mock.calls[0]?.[0] as string;
    expect(selectArg).toMatch(/patients\(first_name, last_name, phone\)/);

    expect(result.appointments).toHaveLength(1);
    const row = result.appointments[0] as {
      patients: { phone?: string };
    };
    expect(row.patients.phone).toBe("09172222222");
  });

  it("admin keeps clinic-wide list (no doctor_id filter)", async () => {
    const builder = chain({ data: [], error: null });
    mockFrom.mockReturnValue(builder);

    const { listStaffAppointments } = await import(
      "@/lib/services/appointment.service"
    );
    await listStaffAppointments("all", {
      role: "admin",
      staffId: "admin-1",
    });

    const eqCalls = (builder.eq as ReturnType<typeof vi.fn>).mock.calls.map(
      (c) => c[0]
    );
    expect(eqCalls).not.toContain("doctor_id");
  });
});

describe("sanitizeDoctorAppointmentRow", () => {
  it("strips phone and other sensitive patient fields", async () => {
    const { sanitizeDoctorAppointmentRow } = await import(
      "@/lib/services/appointment.service"
    );
    const safe = sanitizeDoctorAppointmentRow({
      checkin_id: 9,
      reference_number: "APT9",
      scheduled_time: "11:00",
      appointment_date: "2026-06-06",
      status: "pending",
      approval_status: "approved",
      patient_id: 1,
      doctor_id: "doc-a",
      patients: {
        first_name: "Pat",
        last_name: "ient",
        phone: "09170000000",
        email: "secret@example.com",
        address: "123 Hidden St",
        date_of_birth: "1990-01-01",
      },
      staff: { first_name: "A", last_name: "B" },
      appointment_types: { name: "GP" },
    });

    expect(safe.patients).toEqual({ first_name: "Pat", last_name: "ient" });
    expect(JSON.stringify(safe)).not.toMatch(/09170000000|secret@|Hidden|1990-01-01/);
  });
});

describe("GET /api/appointments staff gate (source)", () => {
  const routeSrc = fs.readFileSync(
    path.resolve(__dirname, "../app/api/appointments/route.ts"),
    "utf8"
  );

  it("uses withStaffAuth for the staff list handler", () => {
    expect(routeSrc).toMatch(/staffListHandler = withStaffAuth/);
  });

  it("passes role and staffId into listStaffAppointments", () => {
    expect(routeSrc).toMatch(/listStaffAppointments\(filter,\s*\{/);
    expect(routeSrc).toMatch(/role:\s*staffSession\.staff\.role/);
    expect(routeSrc).toMatch(/staffId:\s*staffSession\.staff\.id/);
  });

  it("does not call listStaffAppointments with only the filter string", () => {
    expect(routeSrc).not.toMatch(/listStaffAppointments\(filter\)\s*;/);
  });
});

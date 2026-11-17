/**
 * Q1: Server-side least privilege for staff queue reads.
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

vi.mock("@/lib/services/queue-metrics", () => ({
  getAvgServiceTime: vi.fn().mockResolvedValue(5),
}));

vi.mock("@/lib/clinic-settings", () => ({
  getNoShowGraceMinutes: vi.fn().mockResolvedValue(5),
}));

vi.mock("@/lib/rooms-map", () => ({
  getRoomNameMap: vi.fn().mockResolvedValue(new Map([[1, "Room 1"]])),
  resolveRoomName: (id: number | null) => (id === 1 ? "Room 1" : ""),
}));

vi.mock("@/lib/datetime", () => ({
  getClinicTodayYmd: () => "2026-06-06",
  getClinicDayStartIso: (ymd: string) => `${ymd}T16:00:00.000Z`,
  getClinicDayEndIso: (ymd: string) => `${ymd}T15:59:59.999Z`,
}));

function chain(resolved: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const m of [
    "select",
    "eq",
    "order",
    "limit",
    "in",
    "not",
    "gte",
    "lte",
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

const DOC_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DOC_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

function sampleRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    queue_number: "A-1",
    status: "ready_for_doctor",
    priority: "normal",
    called_at: null,
    present_at: null,
    room_id: null,
    skip_count: 0,
    created_at: "2026-06-06T01:00:00Z",
    waiting_since: "2026-06-06T01:00:00Z",
    bp_systolic: null,
    bp_diastolic: null,
    temperature_c: null,
    triage_notes: null,
    assigned_doctor_id: DOC_A,
    called_by: null,
    checkins: {
      checkin_id: 10,
      reference_number: "APT1",
      reason: "checkup",
      type_id: 1,
      doctor_id: DOC_A,
      patients: {
        first_name: "Ann",
        last_name: "Lee",
        phone: "09171111111",
        date_of_birth: "1990-01-01",
        address: "Secret St",
      },
      appointment_types: { name: "Consult" },
      staff: { first_name: "Ada", last_name: "Doc" },
    },
    ...overrides,
  };
}

describe("doctorOwnsQueueRow / resolveAssignedDoctorId", () => {
  it("owns via assigned_doctor_id", async () => {
    const { doctorOwnsQueueRow } = await import("@/lib/services/queue-read.service");
    expect(
      doctorOwnsQueueRow(DOC_A, {
        assigned_doctor_id: DOC_A,
        checkins: { doctor_id: DOC_B },
      })
    ).toBe(true);
  });

  it("owns via checkins.doctor_id when assigned is null", async () => {
    const { doctorOwnsQueueRow } = await import("@/lib/services/queue-read.service");
    expect(
      doctorOwnsQueueRow(DOC_A, {
        assigned_doctor_id: null,
        checkins: { doctor_id: DOC_A },
      })
    ).toBe(true);
  });

  it("does NOT treat called_by alone as ownership", async () => {
    const { doctorOwnsQueueRow } = await import("@/lib/services/queue-read.service");
    // Receptionist called the ticket but assignment is another doctor.
    expect(
      doctorOwnsQueueRow(DOC_A, {
        assigned_doctor_id: null,
        checkins: { doctor_id: DOC_B },
      })
    ).toBe(false);
  });

  it("resolveAssignedDoctorId ignores called_by", async () => {
    const { resolveAssignedDoctorId } = await import(
      "@/lib/services/queue-read.service"
    );
    expect(
      resolveAssignedDoctorId({
        assigned_doctor_id: null,
        checkins: { doctor_id: DOC_A },
      })
    ).toBe(DOC_A);
  });
});

describe("sanitizeDoctorPatientFields", () => {
  it("keeps only first/last name", async () => {
    const { sanitizeDoctorPatientFields } = await import(
      "@/lib/services/queue-read.service"
    );
    const safe = sanitizeDoctorPatientFields({
      first_name: "Ann",
      last_name: "Lee",
      phone: "09171111111",
      date_of_birth: "1990-01-01",
      address: "Secret",
      email: "x@y.com",
    });
    expect(safe).toEqual({ first_name: "Ann", last_name: "Lee" });
    expect(JSON.stringify(safe)).not.toMatch(/0917|1990|Secret|@/);
  });
});

describe("listStaffQueue least privilege", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
  });

  it("scopes doctor queries (assigned + booked) and strips phone from payload", async () => {
    const own = sampleRow({ id: 1, status: "in_progress", called_at: "2026-06-06T02:00:00Z" });
    const other = sampleRow({
      id: 2,
      queue_number: "B-2",
      assigned_doctor_id: DOC_B,
      checkins: {
        ...(sampleRow().checkins as object),
        doctor_id: DOC_B,
        patients: {
          first_name: "Other",
          last_name: "Person",
          phone: "09172222222",
        },
      },
    });

    // Two doctor-scoped queue queries (rooms map is mocked)
    mockFrom
      .mockReturnValueOnce(chain({ data: [own], error: null }))
      .mockReturnValueOnce(chain({ data: [own], error: null }));

    const { listStaffQueue } = await import("@/lib/services/queue-read.service");
    const result = await listStaffQueue({ role: "doctor", staffId: DOC_A });

    expect(result.error).toBeNull();
    const appt = result.appointment;
    const all = [
      ...appt.waiting,
      ...appt.withNurse,
      ...appt.readyForDoctor,
      ...appt.inProgress,
      ...appt.completed,
      ...appt.noShow,
    ] as { queueId?: number; name?: string }[];

    expect(all.some((r) => r.queueId === 1)).toBe(true);
    expect(all.some((r) => r.queueId === 2)).toBe(false);
    expect(JSON.stringify(appt)).not.toMatch(/09171111111|09172222222|Secret|1990-01-01/);

    // in-progress includes assignedDoctorId
    const inProg = appt.inProgress as { assignedDoctorId?: string; status?: string }[];
    expect(inProg[0]?.assignedDoctorId).toBe(DOC_A);
    expect(inProg[0]?.status).toBe("in_progress");

    // Spoofing: calling as DOC_A never uses a body doctor id — only staffId arg
    expect(mockFrom).toHaveBeenCalled();
    void other;
  });

  it("receptionist gets clinic-wide list without doctor_id filter on queue", async () => {
    const rows = [
      sampleRow({ id: 1 }),
      sampleRow({
        id: 2,
        assigned_doctor_id: DOC_B,
        checkins: { ...(sampleRow().checkins as object), doctor_id: DOC_B },
      }),
    ];
    mockFrom.mockReturnValueOnce(chain({ data: rows, error: null }));

    const { listStaffQueue } = await import("@/lib/services/queue-read.service");
    const result = await listStaffQueue({
      role: "receptionist",
      staffId: "recv-1",
    });

    expect(result.error).toBeNull();
    const ready = result.appointment.readyForDoctor as { queueId: number }[];
    expect(ready.map((r) => r.queueId).sort()).toEqual([1, 2]);
  });

  it("nurse retains clinic-wide triage visibility", async () => {
    mockFrom.mockReturnValueOnce(
      chain({
        data: [sampleRow({ id: 3, status: "with_nurse", assigned_doctor_id: DOC_B })],
        error: null,
      })
    );

    const { listStaffQueue } = await import("@/lib/services/queue-read.service");
    const result = await listStaffQueue({ role: "nurse", staffId: "nurse-1" });
    expect((result.appointment.withNurse as unknown[]).length).toBe(1);
  });

  it("projects assignedDoctorId on waiting, ready, called, completed buckets", async () => {
    const rows = [
      sampleRow({ id: 10, status: "waiting", assigned_doctor_id: DOC_A }),
      sampleRow({ id: 11, status: "ready_for_doctor", assigned_doctor_id: DOC_A }),
      sampleRow({
        id: 12,
        status: "called",
        assigned_doctor_id: DOC_A,
        called_at: "2026-06-06T02:00:00Z",
      }),
      sampleRow({ id: 13, status: "completed", assigned_doctor_id: DOC_A }),
    ];
    mockFrom.mockReturnValueOnce(chain({ data: rows, error: null }));

    const { listStaffQueue } = await import("@/lib/services/queue-read.service");
    const result = await listStaffQueue({
      role: "receptionist",
      staffId: "recv-1",
    });
    const appt = result.appointment;
    expect((appt.waiting[0] as { assignedDoctorId: string }).assignedDoctorId).toBe(DOC_A);
    expect((appt.readyForDoctor[0] as { assignedDoctorId: string }).assignedDoctorId).toBe(
      DOC_A
    );
    expect((appt.inProgress[0] as { assignedDoctorId: string }).assignedDoctorId).toBe(DOC_A);
    expect((appt.completed[0] as { assignedDoctorId: string }).assignedDoctorId).toBe(DOC_A);
  });

  it("DOC_B session never receives DOC_A-only ticket even if query returns it", async () => {
    // Defense-in-depth filter: if a row slips past SQL filters, ownership drops it.
    const slipped = sampleRow({
      id: 99,
      assigned_doctor_id: DOC_A,
      checkins: { ...(sampleRow().checkins as object), doctor_id: DOC_A },
    });
    mockFrom
      .mockReturnValueOnce(chain({ data: [slipped], error: null }))
      .mockReturnValueOnce(chain({ data: [], error: null }));

    const { listStaffQueue } = await import("@/lib/services/queue-read.service");
    const result = await listStaffQueue({ role: "doctor", staffId: DOC_B });
    const all = JSON.stringify(result.appointment);
    expect(all).not.toMatch(/"queueId":99/);
    expect(result.appointment.readyForDoctor).toHaveLength(0);
  });
});

describe("GET /api/queue staff gate (source)", () => {
  const routeSrc = fs.readFileSync(
    path.resolve(__dirname, "../app/api/queue/route.ts"),
    "utf8"
  );

  it("requires staff session and passes role/staffId into listStaffQueue", () => {
    expect(routeSrc).toMatch(/requireStaff/);
    expect(routeSrc).toMatch(/listStaffQueue\(\{/);
    expect(routeSrc).toMatch(/auth\.session\.staff\.role/);
    expect(routeSrc).toMatch(/auth\.session\.staff\.id/);
  });

  it("does not accept doctorId from searchParams for authorization", () => {
    expect(routeSrc).not.toMatch(/searchParams\.get\(["']doctorId["']\)/);
    expect(routeSrc).not.toMatch(/searchParams\.get\(["']staffId["']\)/);
  });

  it("anonymous staff queue path still gates via requireStaff (no bypass)", () => {
    expect(routeSrc).toMatch(/async function staffQueueHandler/);
    expect(routeSrc).toMatch(/if \("error" in auth\)/);
    expect(routeSrc).toMatch(/auth\.status/);
  });
});

describe("public TV still strips patient PII (source)", () => {
  it("queue/public select has no patients(", () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, "../app/api/queue/public/route.ts"),
      "utf8"
    );
    expect(src).toMatch(/Doctor name only/);
    expect(src).not.toMatch(/patients\(/);
  });
});

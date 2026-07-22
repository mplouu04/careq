import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn().mockResolvedValue(true),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  isVerificationLockedOut: vi.fn().mockResolvedValue({ locked: false, retryAfterSeconds: 0 }),
  recordVerificationFailure: vi.fn().mockResolvedValue(undefined),
  clearVerificationFailures: vi.fn().mockResolvedValue(undefined),
  PATIENT_VERIFY_RATE_LIMIT: { max: 5, windowSeconds: 60 },
}));

vi.mock("@/lib/audit", () => ({
  logAudit: vi.fn(),
}));

const verifyPatientByDobAndPhone = vi.fn();

vi.mock("@/lib/services/patient.service", () => ({
  verifyPatientByDobAndPhone,
}));

describe("POST /api/patient-verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  async function callVerify(body: unknown) {
    const { POST } = await import("@/app/api/patient-verify/route");
    return POST(
      new Request("http://localhost/api/patient-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
    );
  }

  it("returns generic error for malformed DOB (no field-specific message)", async () => {
    const res = await callVerify({ dob: "not-a-date", phoneLast7: "1234567" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ error: "Invalid input" });
    expect(json.error).not.toMatch(/date of birth|YYYY-MM-DD/i);
  });

  it("returns generic error for invalid phone (no field-specific message)", async () => {
    const res = await callVerify({ dob: "1990-01-01", phoneLast7: "123" });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ error: "Invalid input" });
    expect(json.error).not.toMatch(/phone|7 digits/i);
  });

  it("returns generic error for invalid JSON body", async () => {
    const { POST } = await import("@/app/api/patient-verify/route");
    const res = await POST(
      new Request("http://localhost/api/patient-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual({ error: "Invalid input" });
  });

  it("returns identical no-match response regardless of wrong field", async () => {
    verifyPatientByDobAndPhone.mockResolvedValue({ matched: false });

    const wrongDob = await callVerify({ dob: "1990-01-01", phoneLast7: "9999999" });
    const wrongPhone = await callVerify({ dob: "1985-05-05", phoneLast7: "1234567" });

    expect(wrongDob.status).toBe(200);
    expect(wrongPhone.status).toBe(200);
    expect(await wrongDob.json()).toEqual({ matched: false });
    expect(await wrongPhone.json()).toEqual({ matched: false });
  });

  it("returns first name and verify token on successful match", async () => {
    verifyPatientByDobAndPhone.mockResolvedValue({
      matched: true,
      firstName: "Jane",
      verifyToken: "token-abc",
    });

    const res = await callVerify({ dob: "1990-01-01", phoneLast7: "1234567" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      matched: true,
      firstName: "Jane",
      verifyToken: "token-abc",
    });
  });
});

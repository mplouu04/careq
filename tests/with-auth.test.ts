import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
  };
});

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getClientIp: vi.fn().mockReturnValue("127.0.0.1"),
  isVerificationLockedOut: vi.fn().mockResolvedValue({ locked: false, retryAfterSeconds: 0 }),
  PATIENT_VERIFY_RATE_LIMIT: { max: 5, windowSeconds: 60 },
}));

describe("withRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 429 with Retry-After header when rate limit exceeded", async () => {
    const { checkRateLimit } = await import("@/lib/rate-limit");
    vi.mocked(checkRateLimit).mockResolvedValue(false);

    const { withRateLimit } = await import("@/lib/api/with-auth");
    const handler = withRateLimit(
      "patient_search",
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 }),
      { max: 30, windowSeconds: 60 }
    );

    const res = await handler(new Request("http://localhost/api/patients?term=ab"));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("60");

    const body = await res.json();
    expect(body).toEqual({ error: "Too many requests" });
  });

  it("returns 429 when patient-verify lockout is active", async () => {
    const { isVerificationLockedOut } = await import("@/lib/rate-limit");
    vi.mocked(isVerificationLockedOut).mockResolvedValue({
      locked: true,
      retryAfterSeconds: 600,
    });

    const { withPatientVerifyRateLimit } = await import("@/lib/api/with-auth");
    const handler = withPatientVerifyRateLimit(
      async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
    );

    const res = await handler(
      new Request("http://localhost/api/patient-verify", { method: "POST" })
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBe("600");
  });
});

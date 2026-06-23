import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

function chain(resolved: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  const self = () => builder;
  for (const m of [
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "in",
    "order",
    "limit",
    "maybeSingle",
  ]) {
    builder[m] = vi.fn(self);
  }
  builder.then = (resolve: (v: unknown) => void) => {
    resolve(resolved);
    return Promise.resolve(resolved);
  };
  return builder;
}

describe("patient-verify rate limit config", () => {
  it("allows 5 requests per 60 seconds", async () => {
    const { PATIENT_VERIFY_RATE_LIMIT } = await import("@/lib/rate-limit");
    expect(PATIENT_VERIFY_RATE_LIMIT.max).toBe(5);
    expect(PATIENT_VERIFY_RATE_LIMIT.windowSeconds).toBe(60);
  });

  it("locks out for 15 minutes after 5 consecutive failures", async () => {
    const { PATIENT_VERIFY_LOCKOUT } = await import("@/lib/rate-limit");
    expect(PATIENT_VERIFY_LOCKOUT.maxFailures).toBe(5);
    expect(PATIENT_VERIFY_LOCKOUT.lockoutSeconds).toBe(900);
  });
});

describe("isVerificationLockedOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not locked when no lockout row exists", async () => {
    mockFrom.mockReturnValue(chain({ data: null }));

    const { isVerificationLockedOut } = await import("@/lib/rate-limit");
    const result = await isVerificationLockedOut("192.168.1.1");

    expect(result).toEqual({ locked: false, retryAfterSeconds: 0 });
  });

  it("returns locked with remaining seconds when lockout is active", async () => {
    const lockoutStart = new Date(Date.now() - 60_000).toISOString();
    mockFrom.mockReturnValue(chain({ data: { window_start: lockoutStart } }));

    const { isVerificationLockedOut } = await import("@/lib/rate-limit");
    const result = await isVerificationLockedOut("192.168.1.1");

    expect(result.locked).toBe(true);
    expect(result.retryAfterSeconds).toBeGreaterThan(800);
    expect(result.retryAfterSeconds).toBeLessThanOrEqual(900);
  });
});

describe("recordVerificationFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts first failure when none exist", async () => {
    const insert = vi.fn().mockReturnValue(chain({ data: null, error: null }));
    mockFrom.mockImplementation((table: string) => {
      if (table === "rate_limits") {
        return {
          select: vi.fn().mockReturnValue(chain({ data: null, error: null })),
          insert,
          delete: vi.fn().mockReturnValue(chain({ data: null, error: null })),
        };
      }
      return chain({ data: null });
    });

    const { recordVerificationFailure } = await import("@/lib/rate-limit");
    await recordVerificationFailure("10.0.0.1");

    expect(insert).toHaveBeenCalledWith({
      action: "patient_verify_failures",
      ip_address: "10.0.0.1",
      request_count: 1,
      window_start: expect.any(String),
    });
  });

  it("creates lockout row after fifth consecutive failure", async () => {
    const insert = vi.fn().mockReturnValue(chain({ data: null, error: null }));
    const del = vi.fn().mockReturnValue(chain({ data: null, error: null }));
    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue(
        chain({ data: { id: 42, request_count: 4 }, error: null })
      ),
      update: vi.fn().mockReturnValue(chain({ data: null, error: null })),
      insert,
      delete: del,
    }));

    const { recordVerificationFailure } = await import("@/lib/rate-limit");
    await recordVerificationFailure("10.0.0.2");

    expect(del).toHaveBeenCalled();
    expect(insert).toHaveBeenCalledWith({
      action: "patient_verify_lockout",
      ip_address: "10.0.0.2",
      request_count: 1,
      window_start: expect.any(String),
    });
  });
});

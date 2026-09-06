import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
    rpc: mockRpc,
  }),
}));

vi.mock("@/lib/email", () => ({
  sendEmailVerificationCode: vi.fn().mockResolvedValue({ ok: true, id: "msg_1" }),
}));

vi.mock("@/lib/env", () => ({
  getEnvSafe: () => ({
    RESEND_API_KEY: "re_test",
    RESEND_FROM_EMAIL: "clinic@example.com",
    CLINIC_NAME: "Test Clinic",
    CRON_SECRET: "test-cron-secret-16",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
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

describe("email-verify.service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockRpc.mockReset();
  });

  it("hashEmailCode is stable for same inputs", async () => {
    const { hashEmailCode } = await import("../lib/services/email-verify.service");
    expect(hashEmailCode("123456", "a@b.com")).toBe(hashEmailCode("123456", "a@b.com"));
    expect(hashEmailCode("123456", "a@b.com")).not.toBe(hashEmailCode("654321", "a@b.com"));
  });

  it("generateEmailCode returns 6 digits", async () => {
    const { generateEmailCode } = await import("../lib/services/email-verify.service");
    const code = generateEmailCode();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("consumeEmailProof marks token used", async () => {
    mockFrom.mockReturnValue(
      chain({ data: { token: "550e8400-e29b-41d4-a716-446655440000" }, error: null })
    );
    const { consumeEmailProof } = await import("../lib/services/email-verify.service");
    await expect(
      consumeEmailProof("550e8400-e29b-41d4-a716-446655440000", "patient@example.com")
    ).resolves.toBeUndefined();
    expect(mockFrom).toHaveBeenCalledWith("email_proofs");
  });

  it("consumeEmailProof throws 403 when invalid", async () => {
    mockFrom.mockReturnValue(chain({ data: null, error: null }));
    const { consumeEmailProof } = await import("../lib/services/email-verify.service");
    await expect(
      consumeEmailProof("550e8400-e29b-41d4-a716-446655440000", "patient@example.com")
    ).rejects.toMatchObject({
      message: "Email verification required. Please verify your email.",
      status: 403,
    });
  });

  it("sendEmailVerification stores hashed code and sends email", async () => {
    mockFrom
      .mockReturnValueOnce(chain({ data: null, error: null }))
      .mockReturnValueOnce(chain({ data: { id: "1" }, error: null }));

    const { sendEmailVerificationCode } = await import("../lib/email");
    const { sendEmailVerification } = await import("../lib/services/email-verify.service");
    const result = await sendEmailVerification("Patient@Example.com", "127.0.0.1");
    expect(result).toEqual({ ok: true });
    expect(sendEmailVerificationCode).toHaveBeenCalled();
    expect(mockFrom).toHaveBeenCalledWith("email_verifications");
  });
});

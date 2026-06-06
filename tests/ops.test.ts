import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("lib/env", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.resetModules();
  });

  it("parses valid minimal env", async () => {
    process.env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      NODE_ENV: "test",
    };
    const { getEnvSafe } = await import("../lib/env");
    const env = getEnvSafe();
    expect(env?.NEXT_PUBLIC_SUPABASE_URL).toBe("https://example.supabase.co");
    expect(env?.RETENTION_DAYS).toBe(90);
  });

  it("rejects mismatched Resend config", async () => {
    process.env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      RESEND_API_KEY: "re_test",
      NODE_ENV: "test",
    };
    const { getEnvSafe } = await import("../lib/env");
    expect(getEnvSafe()).toBeNull();
  });

  it("requires CRON_SECRET in production without VERCEL_ENV", async () => {
    process.env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      NODE_ENV: "production",
    };
    const { getEnvSafe } = await import("../lib/env");
    expect(getEnvSafe()).toBeNull();
  });
});

describe("lib/email sendAppointmentReminder", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("skips send when Resend is not configured", async () => {
    process.env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service",
      NODE_ENV: "test",
    };
    const { sendAppointmentReminder } = await import("../lib/email");
    const result = await sendAppointmentReminder({
      to: "patient@example.com",
      patientName: "Ana Cruz",
      referenceNumber: "APT20260607001",
      appointmentDate: "Sunday, June 7, 2026",
      appointmentTime: "9:00 AM",
      doctorName: "Dr. Santos",
      clinicName: "Care Clinic",
      clinicAddress: "123 Main St",
      statusUrl: "http://localhost:3000/status/APT20260607001",
    });
    expect(result).toEqual({
      ok: false,
      error: "Email provider not configured",
      retryable: false,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("lib/cron-auth verifyCronAuth", () => {
  afterEach(() => {
    delete process.env.CRON_SECRET;
    vi.resetModules();
  });

  it("returns 503 when CRON_SECRET is missing", async () => {
    const { verifyCronAuth } = await import("../lib/cron-auth");
    const res = verifyCronAuth(new Request("http://localhost/api/cron/reminders"));
    expect(res?.status).toBe(503);
  });

  it("returns null for valid bearer token", async () => {
    process.env.CRON_SECRET = "test-secret-min-16-chars";
    const { verifyCronAuth } = await import("../lib/cron-auth");
    const res = verifyCronAuth(
      new Request("http://localhost/api/cron/reminders", {
        headers: { authorization: "Bearer test-secret-min-16-chars" },
      })
    );
    expect(res).toBeNull();
  });
});

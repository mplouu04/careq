import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const addBreadcrumb = vi.fn();
const captureMessage = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  addBreadcrumb,
  captureMessage,
}));

describe("logRealtimeStatus", () => {
  const originalEnv = { ...process.env };
  let warnSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.resetModules();
    addBreadcrumb.mockClear();
    captureMessage.mockClear();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    logSpy.mockRestore();
    process.env = { ...originalEnv };
  });

  it("logs SUBSCRIBED as info and skips captureMessage", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@example.ingest.sentry.io/1";
    const { logRealtimeStatus } = await import("../lib/observability-client");

    logRealtimeStatus("doctors:changes", "SUBSCRIBED");

    expect(addBreadcrumb).toHaveBeenCalledWith(
      expect.objectContaining({
        category: "realtime",
        level: "info",
        message: "doctors:changes:SUBSCRIBED",
      })
    );
    expect(captureMessage).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalled();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("elevates CHANNEL_ERROR and TIMED_OUT to captureMessage warnings", async () => {
    process.env.NEXT_PUBLIC_SENTRY_DSN = "https://key@example.ingest.sentry.io/1";
    const { logRealtimeStatus } = await import("../lib/observability-client");

    logRealtimeStatus("doctors:changes", "CHANNEL_ERROR", { extra: 1 });
    logRealtimeStatus("doctors:changes", "TIMED_OUT");

    expect(captureMessage).toHaveBeenCalledTimes(2);
    expect(captureMessage).toHaveBeenNthCalledWith(
      1,
      "realtime_channel_error",
      expect.objectContaining({ level: "warning" })
    );
    expect(captureMessage).toHaveBeenNthCalledWith(
      2,
      "realtime_timed_out",
      expect.objectContaining({ level: "warning" })
    );
    expect(warnSpy).toHaveBeenCalledTimes(2);
  });

  it("no-ops Sentry calls when DSN is not configured", async () => {
    delete process.env.NEXT_PUBLIC_SENTRY_DSN;
    const { logRealtimeStatus } = await import("../lib/observability-client");

    logRealtimeStatus("doctors:changes", "CHANNEL_ERROR");

    expect(addBreadcrumb).not.toHaveBeenCalled();
    expect(captureMessage).not.toHaveBeenCalled();
    // Still emits the console line so ops can grep logs.
    expect(warnSpy).toHaveBeenCalled();
  });
});

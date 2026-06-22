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
});

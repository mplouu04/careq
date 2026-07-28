import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("lib/supabase/broadcast", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
    vi.stubGlobal("fetch", vi.fn());
    process.env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
      NODE_ENV: "test",
    };
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    process.env = { ...originalEnv };
  });

  it("POSTs to /realtime/v1/api/broadcast with service role headers", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "ok" }), { status: 200 })
    );

    const { broadcastRealtime } = await import("../lib/supabase/broadcast");
    const result = await broadcastRealtime({
      topic: "doctors:changes",
      event: "changed",
      payload: { id: "doc-1" },
    });

    expect(result).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://example.supabase.co/realtime/v1/api/broadcast");
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
    });
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.apikey).toBe("service-role-key");
    expect(headers.Authorization).toBe("Bearer service-role-key");

    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      messages: [
        {
          topic: "doctors:changes",
          event: "changed",
          payload: { id: "doc-1" },
          private: false,
        },
      ],
    });
  });

  it("returns ok:false without throwing when the endpoint responds with non-2xx", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: "boom" }), { status: 500 })
    );

    const { broadcastRealtime } = await import("../lib/supabase/broadcast");
    const result = await broadcastRealtime({
      topic: "t",
      event: "e",
    });

    expect(result).toEqual({ ok: false });
  });

  it("returns ok:false without throwing when fetch rejects", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValue(new Error("network down"));

    const { broadcastRealtime } = await import("../lib/supabase/broadcast");
    const result = await broadcastRealtime({
      topic: "t",
      event: "e",
    });

    expect(result).toEqual({ ok: false });
  });

  it("skips broadcast when service role env is missing", async () => {
    process.env = {
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon",
      // SUPABASE_SERVICE_ROLE_KEY intentionally omitted
      NODE_ENV: "test",
    };
    const fetchMock = vi.mocked(fetch);

    const { broadcastRealtime } = await import("../lib/supabase/broadcast");
    const result = await broadcastRealtime({
      topic: "t",
      event: "e",
    });

    expect(result).toEqual({ ok: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("broadcastDoctorsChanged forwards payload on the doctors channel", async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ message: "ok" }), { status: 200 })
    );

    const { broadcastDoctorsChanged } = await import("../lib/supabase/broadcast");
    await broadcastDoctorsChanged({
      id: "doc-1",
      is_active: true,
      action: "activate",
      at: "2026-07-28T15:00:00.000Z",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse(
      (fetchMock.mock.calls[0]![1] as RequestInit).body as string
    );
    expect(body.messages[0].topic).toBe("doctors:changes");
    expect(body.messages[0].event).toBe("changed");
    expect(body.messages[0].payload).toEqual({
      id: "doc-1",
      is_active: true,
      action: "activate",
      at: "2026-07-28T15:00:00.000Z",
    });
  });
});

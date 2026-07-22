/**
 * Web Push helpers: payload building and stale-subscription (410) cleanup.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockSendNotification = vi.fn();
const mockSetVapidDetails = vi.fn();

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock("@/lib/rooms-map", () => ({
  getRoomNameMap: vi.fn().mockResolvedValue(new Map([[1, "Room A"]])),
  resolveRoomName: (id: number | null, map: Map<number, string>) =>
    id == null ? "" : (map.get(id) ?? `Room ${id}`),
}));

vi.mock("@/lib/env", () => ({
  getEnvSafe: () => ({
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
    VAPID_PRIVATE_KEY: "private-key",
    VAPID_SUBJECT: "mailto:test@example.com",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
  }),
}));

vi.mock("@/lib/observability", () => ({
  logWarn: vi.fn(),
  logInfo: vi.fn(),
  captureException: vi.fn(),
}));

vi.mock("web-push", () => ({
  default: {
    setVapidDetails: (...args: unknown[]) => mockSetVapidDetails(...args),
    sendNotification: (...args: unknown[]) => mockSendNotification(...args),
  },
  setVapidDetails: (...args: unknown[]) => mockSetVapidDetails(...args),
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
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
    "upsert",
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

describe("buildQueueCalledPushPayload", () => {
  it("includes room and doctor in the body", async () => {
    const { buildQueueCalledPushPayload } = await import("../lib/push");
    const payload = buildQueueCalledPushPayload({
      queueNumber: "WALK-5",
      room: "Room A",
      doctorName: "Dr. Jane Doe",
      statusUrl: "http://localhost:3000/status/WALK-5",
    });

    expect(payload.title).toBe("It's your turn!");
    expect(payload.body).toContain("WALK-5");
    expect(payload.body).toContain("Room A");
    expect(payload.body).toContain("Dr. Jane Doe");
    expect(payload.url).toBe("http://localhost:3000/status/WALK-5");
    expect(payload.tag).toBe("careq-called-WALK-5");
  });

  it("omits room/doctor fragments when empty", async () => {
    const { buildQueueCalledPushPayload } = await import("../lib/push");
    const payload = buildQueueCalledPushPayload({
      queueNumber: "APPT-12",
      room: "",
      doctorName: "",
      statusUrl: "http://localhost:3000/status/APPT-12",
    });

    expect(payload.body).toBe("Queue APPT-12 — please proceed.");
  });
});

describe("sendQueueCalledPush", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendNotification.mockReset();
    mockSetVapidDetails.mockReset();
  });

  it("returns ok when web-push succeeds", async () => {
    mockSendNotification.mockResolvedValue(undefined);
    const { sendQueueCalledPush } = await import("../lib/push");

    const result = await sendQueueCalledPush(
      { endpoint: "https://push.example/sub", p256dh: "k", auth: "a" },
      {
        queueNumber: "WALK-1",
        room: "Room A",
        doctorName: "Dr. X",
        statusUrl: "http://localhost:3000/status/WALK-1",
      }
    );

    expect(result).toEqual({ ok: true });
    expect(mockSetVapidDetails).toHaveBeenCalled();
    expect(mockSendNotification).toHaveBeenCalled();
  });

  it("returns gone=true on HTTP 410", async () => {
    const err = Object.assign(new Error("Gone"), { statusCode: 410 });
    mockSendNotification.mockRejectedValue(err);
    const { sendQueueCalledPush } = await import("../lib/push");

    const result = await sendQueueCalledPush(
      { endpoint: "https://push.example/stale", p256dh: "k", auth: "a" },
      {
        queueNumber: "WALK-2",
        room: "",
        doctorName: "",
        statusUrl: "http://localhost:3000/status/WALK-2",
      }
    );

    expect(result).toEqual({
      ok: false,
      error: "Gone",
      statusCode: 410,
      gone: true,
    });
  });
});

describe("notifyPatientCalled subscription cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReset();
    mockSendNotification.mockReset();
  });

  it("deletes subscription when push returns 410", async () => {
    const err = Object.assign(new Error("Gone"), { statusCode: 410 });
    mockSendNotification.mockRejectedValue(err);

    const deleteEq = vi.fn().mockResolvedValue({ data: null, error: null });
    const deleteBuilder = { eq: deleteEq };

    // 1) queue load  2) push_subscriptions select  3) delete stale
    mockFrom
      .mockReturnValueOnce(
        chain({
          data: {
            id: 1,
            queue_number: "WALK-5",
            room_id: 1,
            called_by: "doc-1",
            called_by_staff: { first_name: "Jane", last_name: "Doe" },
          },
          error: null,
        })
      )
      .mockReturnValueOnce(
        chain({
          data: [
            {
              id: 9,
              endpoint: "https://push.example/stale",
              p256dh: "k",
              auth: "a",
            },
          ],
          error: null,
        })
      )
      .mockReturnValueOnce({
        delete: () => deleteBuilder,
      });

    const { notifyPatientCalled } = await import("../lib/services/queue-notify.service");
    await notifyPatientCalled(1);

    expect(deleteEq).toHaveBeenCalledWith("endpoint", "https://push.example/stale");
  });
});

import { getEnvSafe } from "@/lib/env";
import { captureException, logWarn } from "@/lib/observability";

export type PushSubscriptionKeys = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export type QueueCalledPushPayload = {
  queueNumber: string;
  room: string;
  doctorName: string;
  statusUrl: string;
};

export type SendPushResult =
  | { ok: true }
  | { ok: false; error: string; statusCode?: number; gone?: boolean };

export function buildQueueCalledPushPayload(payload: QueueCalledPushPayload): {
  title: string;
  body: string;
  url: string;
  tag: string;
} {
  const roomPart = payload.room ? ` to ${payload.room}` : "";
  const doctorPart = payload.doctorName ? ` (${payload.doctorName})` : "";
  return {
    title: "It's your turn!",
    body: `Queue ${payload.queueNumber} — please proceed${roomPart}${doctorPart}.`,
    url: payload.statusUrl,
    tag: `careq-called-${payload.queueNumber}`,
  };
}

function vapidConfigured(): {
  publicKey: string;
  privateKey: string;
  subject: string;
} | null {
  const env = getEnvSafe();
  if (
    !env?.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
    !env?.VAPID_PRIVATE_KEY ||
    !env?.VAPID_SUBJECT
  ) {
    return null;
  }
  return {
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT,
  };
}

/** Sends a Web Push notification. Returns gone=true when the subscription is stale (410). */
export async function sendQueueCalledPush(
  subscription: PushSubscriptionKeys,
  payload: QueueCalledPushPayload
): Promise<SendPushResult> {
  const vapid = vapidConfigured();
  if (!vapid) {
    logWarn("push_skipped", {
      reason: "VAPID keys not configured",
      queueNumber: payload.queueNumber,
    });
    return { ok: false, error: "Push provider not configured" };
  }

  const notification = buildQueueCalledPushPayload(payload);

  try {
    const webpushMod = await import("web-push");
    const webpush =
      "default" in webpushMod && webpushMod.default
        ? (webpushMod.default as typeof webpushMod)
        : webpushMod;
    webpush.setVapidDetails(vapid.subject, vapid.publicKey, vapid.privateKey);

    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
        },
      },
      JSON.stringify(notification),
      { TTL: 60 * 30, urgency: "high" }
    );

    return { ok: true };
  } catch (err) {
    const statusCode =
      err && typeof err === "object" && "statusCode" in err
        ? Number((err as { statusCode: number }).statusCode)
        : undefined;
    const message = err instanceof Error ? err.message : "Push send failed";

    if (statusCode === 404 || statusCode === 410) {
      return { ok: false, error: message, statusCode, gone: true };
    }

    logWarn("push_send_failed", {
      queueNumber: payload.queueNumber,
      statusCode,
      message,
    });
    captureException(err, {
      context: "sendQueueCalledPush",
      queueNumber: payload.queueNumber,
    });
    return { ok: false, error: message, statusCode };
  }
}

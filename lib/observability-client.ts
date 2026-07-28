"use client";

import * as Sentry from "@sentry/nextjs";

/**
 * Log a Supabase Realtime channel subscribe-status transition. Silent WS drops
 * are the single-point-of-failure for the doctor list invalidation path — see
 * plan doctor_activation_delay_rca (H3). Surface them to Sentry as breadcrumbs
 * (and once-per-session warnings for the error/timeout terminals) so we can
 * confirm whether a stale booking page correlates with a dropped socket.
 */
type RealtimeStatus =
  | "SUBSCRIBED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT"
  | "CLOSED"
  | (string & {});

const dsnConfigured = Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN);

export function logRealtimeStatus(
  channel: string,
  status: RealtimeStatus,
  extra?: Record<string, unknown>
): void {
  const level: Sentry.SeverityLevel =
    status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "warning" : "info";

  if (dsnConfigured) {
    Sentry.addBreadcrumb({
      category: "realtime",
      level,
      message: `${channel}:${status}`,
      data: extra,
    });

    if (level === "warning") {
      Sentry.captureMessage(`realtime_${status.toLowerCase()}`, {
        level,
        extra: { channel, ...extra },
      });
    }
  }

  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level: level === "warning" ? "warn" : "info",
    event: "realtime_status",
    channel,
    status,
    ...(extra ?? {}),
  });

  if (level === "warning") {
    // eslint-disable-next-line no-console
    console.warn(line);
  } else {
    // eslint-disable-next-line no-console
    console.log(line);
  }
}

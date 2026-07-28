import { getEnvSafe } from "@/lib/env";
import { captureException, logWarn } from "@/lib/observability";
import {
  DOCTORS_BROADCAST_EVENT,
  DOCTORS_BROADCAST_TOPIC,
} from "@/lib/supabase/broadcast-shared";

/**
 * Server-side helper to fan out a Supabase Realtime Broadcast message via the
 * HTTP endpoint. Broadcast is not RLS-filtered, so it works even when the
 * source table's SELECT policy would hide the changed row from anon clients
 * (see plan doctor_activation_delay_rca, H1).
 *
 * Failure-mode: broadcast is best-effort. If Supabase Realtime is unreachable
 * we log and swallow the error — the client polling fallback (H3) still picks
 * the change up within the configured refetch interval.
 */
export async function broadcastRealtime(params: {
  topic: string;
  event: string;
  payload?: Record<string, unknown>;
}): Promise<{ ok: boolean }> {
  const env = getEnvSafe();
  const url = env?.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    env?.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    logWarn("broadcast_skipped_missing_env", { topic: params.topic });
    return { ok: false };
  }

  try {
    const res = await fetch(`${url}/realtime/v1/api/broadcast`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: params.topic,
            event: params.event,
            payload: params.payload ?? {},
            private: false,
          },
        ],
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      logWarn("broadcast_http_error", {
        topic: params.topic,
        event: params.event,
        status: res.status,
      });
      return { ok: false };
    }

    return { ok: true };
  } catch (err) {
    captureException(err, {
      context: "broadcastRealtime",
      topic: params.topic,
      event: params.event,
    });
    return { ok: false };
  }
}

export { DOCTORS_BROADCAST_EVENT, DOCTORS_BROADCAST_TOPIC };

export type DoctorsChangedPayload = {
  id: string;
  is_active: boolean;
  action: "activate" | "deactivate";
  at: string;
};

export async function broadcastDoctorsChanged(
  payload: DoctorsChangedPayload
): Promise<void> {
  await broadcastRealtime({
    topic: DOCTORS_BROADCAST_TOPIC,
    event: DOCTORS_BROADCAST_EVENT,
    payload,
  });
}

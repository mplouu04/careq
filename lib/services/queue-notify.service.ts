import { createAdminClient } from "@/lib/supabase/admin";
import { getEnvSafe } from "@/lib/env";
import { getRoomNameMap, resolveRoomName } from "@/lib/rooms-map";
import { sendQueueCalledPush } from "@/lib/push";
import { captureException, logWarn } from "@/lib/observability";

/**
 * Fire-and-forget Web Push to all devices subscribed for this queue entry.
 * Safe to call after callNextPatient / recallPatient succeed.
 */
export async function notifyPatientCalled(queueId: number): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data: entry, error } = await supabase
      .from("queue")
      .select(
        `id, queue_number, room_id, called_by,
         called_by_staff:called_by(first_name, last_name)`
      )
      .eq("id", queueId)
      .maybeSingle();

    if (error || !entry) {
      logWarn("push_notify_queue_missing", { queueId, error: error?.message });
      return;
    }

    const calledByRaw = (entry as Record<string, unknown>).called_by_staff;
    const calledBy = (Array.isArray(calledByRaw) ? calledByRaw[0] : calledByRaw) as
      | { first_name: string; last_name: string }
      | null
      | undefined;
    const doctorName = calledBy
      ? `Dr. ${calledBy.first_name} ${calledBy.last_name}`
      : "";

    await fanOutPush(entry.queue_number, entry.room_id, doctorName);
  } catch (err) {
    captureException(err, { context: "notifyPatientCalled", queueId });
  }
}

async function fanOutPush(
  queueNumber: string,
  roomId: number | string | null | undefined,
  doctorName: string
): Promise<void> {
  const supabase = createAdminClient();
  const { data: subs, error } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("queue_number", queueNumber);

  if (error) {
    logWarn("push_subscriptions_load_failed", {
      queueNumber,
      error: error.message,
    });
    return;
  }

  if (!subs || subs.length === 0) return;

  const roomMap = await getRoomNameMap(supabase);
  const room = resolveRoomName(
    roomId == null ? null : Number(roomId),
    roomMap
  );

  const env = getEnvSafe();
  const appUrl = (env?.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const statusUrl = `${appUrl}/status/${encodeURIComponent(queueNumber)}`;

  await Promise.all(
    subs.map(async (sub) => {
      const result = await sendQueueCalledPush(
        { endpoint: sub.endpoint, p256dh: sub.p256dh, auth: sub.auth },
        { queueNumber, room, doctorName, statusUrl }
      );

      if (result.ok === false && result.gone) {
        await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    })
  );
}

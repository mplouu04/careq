import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { getClinicDayStartIso } from "@/lib/datetime";
import { getQueueReport } from "@/lib/services/queue-metrics";

export async function callNextPatient(params: {
  queueId: number;
  doctorId: string;
  roomNumber: string | number;
  userId: string;
  ip: string;
}) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("queue")
    .update({
      called_by: params.doctorId,
      room_id: params.roomNumber,
      status: "in_progress",
      called_at: new Date().toISOString(),
    })
    .eq("id", params.queueId)
    .eq("status", "waiting")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return { error: "Failed to call patient", status: 500 as const };
  }

  await logAudit({
    userId: params.userId,
    action: "queue_call",
    tableName: "queue",
    recordId: params.queueId,
    ipAddress: params.ip,
  });

  return { success: true as const };
}

export async function skipPatient(params: {
  queueId: number;
  userId: string;
  ip: string;
}) {
  const supabase = createAdminClient();
  const { data: current } = await supabase
    .from("queue")
    .select("skip_count")
    .eq("id", params.queueId)
    .eq("status", "in_progress")
    .single();

  if (!current) {
    return { error: "Queue entry not in_progress", status: 400 as const };
  }

  const { error } = await supabase
    .from("queue")
    .update({
      status: "waiting",
      called_by: null,
      room_id: null,
      called_at: null,
      skip_count: (current.skip_count ?? 0) + 1,
    })
    .eq("id", params.queueId)
    .eq("status", "in_progress");

  if (error) {
    return { error: "Failed to skip", status: 500 as const };
  }

  await logAudit({
    userId: params.userId,
    action: "queue_skip",
    tableName: "queue",
    recordId: params.queueId,
    ipAddress: params.ip,
  });

  return { success: true as const };
}

export async function recallPatient(params: {
  queueId: number;
  doctorId: string;
  roomNumber: string | number;
  userId: string;
  ip: string;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("queue")
    .update({
      status: "in_progress",
      called_by: params.doctorId,
      room_id: params.roomNumber,
      called_at: new Date().toISOString(),
    })
    .eq("id", params.queueId)
    .eq("status", "waiting");

  if (error) {
    return { error: "Failed to recall", status: 500 as const };
  }

  await logAudit({
    userId: params.userId,
    action: "queue_recall",
    tableName: "queue",
    recordId: params.queueId,
    ipAddress: params.ip,
  });

  return { success: true as const };
}

export async function markNoShow(params: {
  queueId: number;
  userId: string;
  ip: string;
}) {
  const supabase = createAdminClient();
  const { data: row } = await supabase
    .from("queue")
    .select("id, status, checkin_id")
    .eq("id", params.queueId)
    .maybeSingle();

  if (!row) {
    return { error: "Queue entry not found", status: 404 as const };
  }

  if (!["waiting", "in_progress"].includes(row.status ?? "")) {
    return {
      error: "Only waiting or in-progress patients can be marked no-show",
      status: 400 as const,
    };
  }

  const { error } = await supabase
    .from("queue")
    .update({
      status: "no_show",
      called_by: null,
      room_id: null,
      called_at: null,
    })
    .eq("id", params.queueId);

  if (error) {
    return { error: "Failed to mark no-show", status: 500 as const };
  }

  if (row.checkin_id) {
    await supabase
      .from("checkins")
      .update({ status: "no_show" })
      .eq("checkin_id", row.checkin_id);
  }

  await logAudit({
    userId: params.userId,
    action: "queue_no_show",
    tableName: "queue",
    recordId: params.queueId,
    ipAddress: params.ip,
  });

  return {
    success: true as const,
    message:
      "Patient marked as no-show. Room is available — call the next patient when ready.",
  };
}

export async function markDone(params: {
  queueId: number;
  userId: string;
  ip: string;
}) {
  const supabase = createAdminClient();

  const { data: row } = await supabase
    .from("queue")
    .select("id, checkin_id")
    .eq("id", params.queueId)
    .eq("status", "in_progress")
    .maybeSingle();

  if (!row) {
    return { error: "Failed to mark done", status: 500 as const };
  }

  const { error } = await supabase
    .from("queue")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", params.queueId)
    .eq("status", "in_progress");

  if (error) {
    return { error: "Failed to mark done", status: 500 as const };
  }

  if (row.checkin_id) {
    await supabase
      .from("checkins")
      .update({ status: "completed" })
      .eq("checkin_id", row.checkin_id);
  }

  await logAudit({
    userId: params.userId,
    action: "queue_done",
    tableName: "queue",
    recordId: params.queueId,
    ipAddress: params.ip,
  });

  return { success: true as const };
}

export async function completeQueueEntries(ids: number[]): Promise<number> {
  if (!ids.length) return 0;
  const supabase = createAdminClient();

  const { data: rows } = await supabase
    .from("queue")
    .select("checkin_id")
    .in("id", ids);

  const { data } = await supabase
    .from("queue")
    .update({ status: "completed", completed_at: new Date().toISOString() })
    .in("id", ids)
    .select("id");

  const checkinIds = (rows ?? [])
    .map((r: { checkin_id: number | null }) => r.checkin_id)
    .filter((id): id is number => id != null);

  if (checkinIds.length) {
    await supabase
      .from("checkins")
      .update({ status: "completed" })
      .in("checkin_id", checkinIds);
  }

  return data?.length ?? 0;
}

export async function getAnalyticsReport(days = 7) {
  const dayStart = getClinicDayStartIso();
  const historyDays = Number.isFinite(days) && days >= 1 ? days : 7;
  const report = await getQueueReport(dayStart, historyDays);
  return { success: true as const, ...report };
}

export async function resetDailyQueue(params: { userId: string; ip: string }) {
  const supabase = createAdminClient();
  const dayStart = getClinicDayStartIso();
  const { data } = await supabase
    .from("queue")
    .update({ status: "cancelled" })
    .eq("status", "waiting")
    .gte("created_at", dayStart)
    .select("id");

  await logAudit({
    userId: params.userId,
    action: "queue_reset_daily",
    tableName: "queue",
    recordId: null,
    ipAddress: params.ip,
  });

  return { success: true as const, cancelled: data?.length ?? 0 };
}

export async function purgeQueueHistory(params: { userId: string; ip: string }) {
  const supabase = createAdminClient();
  const dayStart = getClinicDayStartIso();

  const { data: deletedQueue } = await supabase
    .from("queue")
    .delete()
    .in("status", ["completed", "cancelled"])
    .lt("created_at", dayStart)
    .select("id");

  const queueDeleted = deletedQueue?.length ?? 0;

  const { data: orphanCheckins } = await supabase
    .from("checkins")
    .select("checkin_id")
    .in("status", ["completed", "cancelled"])
    .lt("created_at", dayStart);

  let checkinsDeleted = 0;
  if (orphanCheckins?.length) {
    const checkinIds = orphanCheckins.map((c) => c.checkin_id);
    const { data: queueLinked } = await supabase
      .from("queue")
      .select("checkin_id")
      .in("checkin_id", checkinIds);

    const linkedIds = new Set(queueLinked?.map((q) => q.checkin_id));
    const toDelete = checkinIds.filter((id) => !linkedIds.has(id));

    if (toDelete.length) {
      const { data: deleted } = await supabase
        .from("checkins")
        .delete()
        .in("checkin_id", toDelete)
        .select("checkin_id");
      checkinsDeleted = deleted?.length ?? 0;
    }
  }

  await logAudit({
    userId: params.userId,
    action: "purge_history",
    tableName: "queue",
    recordId: null,
    ipAddress: params.ip,
  });

  return {
    success: true as const,
    queue_deleted: queueDeleted,
    checkins_deleted: checkinsDeleted,
  };
}

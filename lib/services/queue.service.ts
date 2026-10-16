import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { getClinicDayStartIso, getClinicTodayYmd } from "@/lib/datetime";
import { getQueueReport } from "@/lib/services/queue-metrics";
import { isCalledLikeStatus } from "@/lib/queue-status";
import { notifyPatientCalled } from "@/lib/services/queue-notify.service";
import { getNoShowGraceMinutes } from "@/lib/clinic-settings";

async function getQueueStatus(queueId: number): Promise<string | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("queue")
    .select("status")
    .eq("id", queueId)
    .maybeSingle();
  return data?.status ?? null;
}

async function callOrRecallPatient(
  params: {
    queueId: number;
    doctorId: string;
    roomNumber: string | number;
    userId: string;
    ip: string;
  },
  auditAction: "queue_call" | "queue_recall"
) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("queue")
    .update({
      called_by: params.doctorId,
      room_id: params.roomNumber,
      status: "called",
      called_at: now,
      present_at: null,
    })
    .eq("id", params.queueId)
    .eq("status", "waiting")
    .select("id")
    .maybeSingle();

  if (error || !data) {
    const currentStatus = await getQueueStatus(params.queueId);
    if (isCalledLikeStatus(currentStatus)) {
      return { error: "Already called", status: 409 as const };
    }
    if (currentStatus && currentStatus !== "waiting") {
      return {
        error: `Queue entry is already ${String(currentStatus).replace("_", " ")}`,
        status: 409 as const,
      };
    }
    return {
      error: auditAction === "queue_call" ? "Failed to call patient" : "Failed to recall",
      status: 500 as const,
    };
  }

  void logAudit({
    userId: params.userId,
    action: auditAction,
    tableName: "queue",
    recordId: params.queueId,
    ipAddress: params.ip,
  });

  void notifyPatientCalled(params.queueId);

  return { success: true as const };
}

export async function callNextPatient(params: {
  queueId: number;
  doctorId: string;
  roomNumber: string | number;
  userId: string;
  ip: string;
}) {
  return callOrRecallPatient(params, "queue_call");
}

export async function markPresent(params: {
  queueId: number;
  userId: string;
  ip: string;
}) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("queue")
    .update({
      status: "in_progress",
      present_at: now,
    })
    .eq("id", params.queueId)
    .eq("status", "called")
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "Failed to mark present", status: 500 as const };
  }

  if (!data) {
    const currentStatus = await getQueueStatus(params.queueId);
    if (currentStatus === "in_progress") {
      return { error: "Patient already marked present", status: 409 as const };
    }
    return {
      error: "Only called patients can be marked present",
      status: 400 as const,
    };
  }

  void logAudit({
    userId: params.userId,
    action: "queue_present",
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

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("queue")
    .update({
      status: "waiting",
      called_by: null,
      room_id: null,
      called_at: null,
      present_at: null,
      waiting_since: now,
      skip_count: (current.skip_count ?? 0) + 1,
    })
    .eq("id", params.queueId)
    .eq("status", "in_progress");

  if (error) {
    return { error: "Failed to skip", status: 500 as const };
  }

  void logAudit({
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
  return callOrRecallPatient(params, "queue_recall");
}

const NO_SHOW_ELIGIBLE = ["waiting", "called", "in_progress"] as const;

export async function markNoShow(params: {
  queueId: number;
  userId: string;
  ip: string;
  reason?: string;
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

  if (!NO_SHOW_ELIGIBLE.includes(row.status as (typeof NO_SHOW_ELIGIBLE)[number])) {
    return {
      error: "Only waiting, called, or in-progress patients can be marked no-show",
      status: 400 as const,
    };
  }

  const { data: updated, error } = await supabase
    .from("queue")
    .update({
      status: "no_show",
      called_by: null,
      room_id: null,
      called_at: null,
      present_at: null,
    })
    .eq("id", params.queueId)
    .in("status", [...NO_SHOW_ELIGIBLE])
    .select("id")
    .maybeSingle();

  if (error) {
    return { error: "Failed to mark no-show", status: 500 as const };
  }

  if (!updated) {
    return {
      error: "Only waiting, called, or in-progress patients can be marked no-show",
      status: 409 as const,
    };
  }

  if (row.checkin_id) {
    await supabase
      .from("checkins")
      .update({ status: "no_show" })
      .eq("checkin_id", row.checkin_id)
      .not("status", "in", '("cancelled","completed","no_show")');
  }

  void logAudit({
    userId: params.userId,
    action: params.reason === "auto_grace" ? "queue_auto_no_show" : "queue_no_show",
    tableName: "queue",
    recordId: params.queueId,
    ipAddress: params.ip,
    newValues: params.reason ? { reason: params.reason } : undefined,
  });

  return {
    success: true as const,
    message:
      "Patient marked as no-show. Room is available — call the next patient when ready.",
  };
}

/** Restore a no-show patient to the end of the waiting queue (FIFO). */
export async function returnToQueue(params: {
  queueId: number;
  userId: string;
  ip: string;
}) {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("queue")
    .update({
      status: "waiting",
      called_by: null,
      room_id: null,
      called_at: null,
      present_at: null,
      completed_at: null,
      waiting_since: now,
    })
    .eq("id", params.queueId)
    .eq("status", "no_show")
    .select("id, checkin_id")
    .maybeSingle();

  if (error) {
    return { error: "Failed to return patient to queue", status: 500 as const };
  }

  if (!data) {
    const currentStatus = await getQueueStatus(params.queueId);
    if (!currentStatus) {
      return { error: "Queue entry not found", status: 404 as const };
    }
    return {
      error: "Only no-show patients can be returned to the queue",
      status: 400 as const,
    };
  }

  if (data.checkin_id) {
    await supabase
      .from("checkins")
      .update({ status: "checked_in" })
      .eq("checkin_id", data.checkin_id)
      .eq("status", "no_show");
  }

  void logAudit({
    userId: params.userId,
    action: "queue_return_to_queue",
    tableName: "queue",
    recordId: params.queueId,
    ipAddress: params.ip,
  });

  return { success: true as const };
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
    return { error: "Queue entry is not in progress", status: 409 as const };
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
      .eq("checkin_id", row.checkin_id)
      .not("status", "in", '("cancelled","completed","no_show")');
  }

  void logAudit({
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

/** Auto-mark called patients past grace as no-show. Returns count updated. */
export async function autoNoShowExpiredCalled(params: {
  userId: string;
  ip: string;
}): Promise<number> {
  const supabase = createAdminClient();
  const today = getClinicTodayYmd();
  const graceMinutes = await getNoShowGraceMinutes();
  const cutoff = new Date(Date.now() - graceMinutes * 60_000).toISOString();

  const { data: expired } = await supabase
    .from("queue")
    .select("id, checkin_id")
    .eq("clinic_date", today)
    .eq("status", "called")
    .not("called_at", "is", null)
    .lt("called_at", cutoff);

  if (!expired?.length) return 0;

  const ids = expired.map((r) => r.id);
  const { data: updated } = await supabase
    .from("queue")
    .update({
      status: "no_show",
      called_by: null,
      room_id: null,
      called_at: null,
      present_at: null,
    })
    .in("id", ids)
    .eq("status", "called")
    .select("id");

  const updatedIds = new Set((updated ?? []).map((r) => r.id));
  const checkinIds = expired
    .filter((r) => updatedIds.has(r.id) && r.checkin_id != null)
    .map((r) => r.checkin_id as number);

  if (checkinIds.length) {
    await supabase
      .from("checkins")
      .update({ status: "no_show" })
      .in("checkin_id", checkinIds)
      .not("status", "in", '("cancelled","completed","no_show")');
  }

  await Promise.all(
    Array.from(updatedIds).map((id) =>
      logAudit({
        userId: params.userId,
        action: "queue_auto_no_show",
        tableName: "queue",
        recordId: id,
        newValues: { status: "no_show", reason: "auto_grace", grace_minutes: graceMinutes },
        ipAddress: params.ip,
      })
    )
  );

  return updatedIds.size;
}

export async function getAnalyticsReport(days = 7) {
  const dayStart = getClinicDayStartIso();
  const historyDays = Number.isFinite(days) && days >= 1 ? days : 7;
  const report = await getQueueReport(dayStart, historyDays);
  return { success: true as const, ...report };
}

export async function resetDailyQueue(params: { userId: string; ip: string }) {
  const supabase = createAdminClient();
  const today = getClinicTodayYmd();
  const { data } = await supabase
    .from("queue")
    .update({ status: "cancelled" })
    .eq("status", "waiting")
    .eq("clinic_date", today)
    .select("id");

  void logAudit({
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

  void logAudit({
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

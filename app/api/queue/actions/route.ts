import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";
import { format, subDays } from "date-fns";
import { getClinicDayStartIso } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requireStaff();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { action } = body;
  const supabase = createAdminClient();
  const ip = getClientIp(request);
  const userId = auth.session.userId;

  switch (action) {

    // ── call_next ──────────────────────────────────────────────────────────
    case "call_next": {
      const { queueId, doctorId, roomNumber } = body;
      if (!queueId || !doctorId || !roomNumber) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("queue")
        .update({
          called_by: doctorId,
          room_id: roomNumber,
          status: "in_progress",
          called_at: new Date().toISOString(),
        })
        .eq("id", queueId)
        .eq("status", "waiting")
        .select("id")
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json({ error: "Failed to call patient" }, { status: 500 });
      }
      await logAudit({
        userId,
        action: "queue_call",
        tableName: "queue",
        recordId: queueId,
        ipAddress: ip,
      });
      return NextResponse.json({ success: true });
    }

    // ── skip ──────────────────────────────────────────────────────────────
    case "skip": {
      const { queueId } = body;
      if (!queueId) {
        return NextResponse.json({ error: "Missing queueId" }, { status: 400 });
      }
      const { data: current } = await supabase
        .from("queue")
        .select("skip_count")
        .eq("id", queueId)
        .eq("status", "in_progress")
        .single();

      if (!current) {
        return NextResponse.json({ error: "Queue entry not in_progress" }, { status: 400 });
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
        .eq("id", queueId)
        .eq("status", "in_progress");

      if (error) {
        return NextResponse.json({ error: "Failed to skip" }, { status: 500 });
      }
      await logAudit({
        userId,
        action: "queue_skip",
        tableName: "queue",
        recordId: queueId,
        ipAddress: ip,
      });
      return NextResponse.json({ success: true });
    }

    // ── recall ────────────────────────────────────────────────────────────
    case "recall": {
      const { queueId, doctorId, roomNumber } = body;
      if (!queueId || !doctorId || !roomNumber) {
        return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
      }
      const { error } = await supabase
        .from("queue")
        .update({
          status: "in_progress",
          called_by: doctorId,
          room_id: roomNumber,
          called_at: new Date().toISOString(),
        })
        .eq("id", queueId)
        .eq("status", "waiting");

      if (error) {
        return NextResponse.json({ error: "Failed to recall" }, { status: 500 });
      }
      // No audit on recall (matches legacy behaviour)
      return NextResponse.json({ success: true });
    }

    // ── mark_no_show ──────────────────────────────────────────────────────
    case "mark_no_show": {
      const { queueId } = body;
      if (!queueId) {
        return NextResponse.json({ error: "Missing queueId" }, { status: 400 });
      }

      const { data: row } = await supabase
        .from("queue")
        .select("id, status, checkin_id")
        .eq("id", queueId)
        .maybeSingle();

      if (!row) {
        return NextResponse.json({ error: "Queue entry not found" }, { status: 404 });
      }

      if (!["waiting", "in_progress"].includes(row.status ?? "")) {
        return NextResponse.json(
          { error: "Only waiting or in-progress patients can be marked no-show" },
          { status: 400 }
        );
      }

      const { error } = await supabase
        .from("queue")
        .update({
          status: "no_show",
          called_by: null,
          room_id: null,
          called_at: null,
        })
        .eq("id", queueId);

      if (error) {
        return NextResponse.json({ error: "Failed to mark no-show" }, { status: 500 });
      }

      if (row.checkin_id) {
        await supabase
          .from("checkins")
          .update({ status: "no_show" })
          .eq("checkin_id", row.checkin_id);
      }

      await logAudit({
        userId,
        action: "queue_no_show",
        tableName: "queue",
        recordId: queueId,
        ipAddress: ip,
      });

      return NextResponse.json({
        success: true,
        message: "Patient marked as no-show. Room is available — call the next patient when ready.",
      });
    }

    // ── mark_done ─────────────────────────────────────────────────────────
    case "mark_done": {
      const { queueId } = body;
      if (!queueId) {
        return NextResponse.json({ error: "Missing queueId" }, { status: 400 });
      }
      const { data, error } = await supabase
        .from("queue")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueId)
        .eq("status", "in_progress")
        .select("id")
        .maybeSingle();

      if (error || !data) {
        return NextResponse.json({ error: "Failed to mark done" }, { status: 500 });
      }
      await logAudit({
        userId,
        action: "queue_done",
        tableName: "queue",
        recordId: queueId,
        ipAddress: ip,
      });
      return NextResponse.json({ success: true });
    }

    // ── get_analytics ─────────────────────────────────────────────────────
    case "get_analytics": {
      const dayStart = getClinicDayStartIso();
      const { data: completed } = await supabase
        .from("queue")
        .select("called_at, completed_at")
        .eq("status", "completed")
        .gte("called_at", dayStart)
        .not("completed_at", "is", null);

      let avgMinutes = 10;
      if (completed?.length) {
        const total = completed.reduce((sum, row) => {
          const start = new Date(row.called_at!).getTime();
          const end = new Date(row.completed_at!).getTime();
          return sum + (end - start) / 60000;
        }, 0);
        avgMinutes = Math.round(total / completed.length) || 10;
      }

      const { count: waiting } = await supabase
        .from("queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "waiting")
        .gte("created_at", dayStart);

      return NextResponse.json({
        success: true,
        avg_service_time: avgMinutes,
        served_today: completed?.length ?? 0,
        waiting_count: waiting ?? 0,
      });
    }

    // ── get_report ────────────────────────────────────────────────────────
    case "get_report": {
      const dayStart = getClinicDayStartIso();
      const { data: completed } = await supabase
        .from("queue")
        .select("called_at, completed_at")
        .eq("status", "completed")
        .gte("called_at", dayStart)
        .not("completed_at", "is", null);

      let avgMinutes = 10;
      if (completed?.length) {
        const total = completed.reduce((sum, row) => {
          const start = new Date(row.called_at!).getTime();
          const end = new Date(row.completed_at!).getTime();
          return sum + (end - start) / 60000;
        }, 0);
        avgMinutes = Math.round(total / completed.length) || 10;
      }

      const { count: waiting } = await supabase
        .from("queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "waiting")
        .gte("created_at", dayStart);

      // 7-day history
      const chartDays = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), 6 - i);
        return format(d, "yyyy-MM-dd");
      });

      const history = await Promise.all(
        chartDays.map(async (day) => {
          const { count } = await supabase
            .from("queue")
            .select("*", { count: "exact", head: true })
            .eq("status", "completed")
            .gte("completed_at", `${day}T00:00:00`)
            .lte("completed_at", `${day}T23:59:59`);
          return { date: day, served: count ?? 0 };
        })
      );

      return NextResponse.json({
        success: true,
        avg_service_time: avgMinutes,
        served_today: completed?.length ?? 0,
        waiting_count: waiting ?? 0,
        history,
      });
    }

    // ── reset_daily ───────────────────────────────────────────────────────
    case "reset_daily": {
      if (auth.session.staff.role !== "admin") {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
      }
      const dayStart = getClinicDayStartIso();
      const { data } = await supabase
        .from("queue")
        .update({ status: "cancelled" })
        .eq("status", "waiting")
        .gte("created_at", dayStart)
        .select("id");
      await logAudit({
        userId,
        action: "queue_reset_daily",
        tableName: "queue",
        recordId: null,
        ipAddress: ip,
      });
      return NextResponse.json({ success: true, cancelled: data?.length ?? 0 });
    }

    // ── purge_history ─────────────────────────────────────────────────────
    case "purge_history": {
      if (auth.session.staff.role !== "admin") {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
      }
      const dayStart = getClinicDayStartIso();

      // Delete completed/cancelled queue rows from prior days
      const { data: deletedQueue } = await supabase
        .from("queue")
        .delete()
        .in("status", ["completed", "cancelled"])
        .lt("created_at", dayStart)
        .select("id");

      const queueDeleted = deletedQueue?.length ?? 0;

      // Delete orphan checkin rows (no linked queue row) from prior days
      // that are completed/cancelled
      const { data: orphanCheckins } = await supabase
        .from("checkins")
        .select("checkin_id")
        .in("status", ["completed", "cancelled"])
        .lt("created_at", dayStart);

      let checkinsDeleted = 0;
      if (orphanCheckins?.length) {
        const checkinIds = orphanCheckins.map((c) => c.checkin_id);
        // Only delete checkins that have no associated queue rows
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
        userId,
        action: "purge_history",
        tableName: "queue",
        recordId: null,
        ipAddress: ip,
      });

      return NextResponse.json({
        success: true,
        queue_deleted: queueDeleted,
        checkins_deleted: checkinsDeleted,
      });
    }

    default:
      return NextResponse.json({ error: "Invalid or missing action" }, { status: 400 });
  }
}

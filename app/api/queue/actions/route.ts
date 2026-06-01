import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";
import { format, subDays } from "date-fns";

export async function POST(request: Request) {
  const auth = await requireStaff();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const { action } = body;
  const supabase = createAdminClient();
  const ip = getClientIp(request);
  const userId = auth.session.userId;

  switch (action) {
    case "call_next": {
      const { queueId, doctorId, roomNumber } = body;
      if (!queueId || !doctorId || !roomNumber) {
        return NextResponse.json({ error: "Missing fields" }, { status: 400 });
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

    case "skip": {
      const { queueId } = body;
      const { data } = await supabase
        .from("queue")
        .select("skip_count")
        .eq("id", queueId)
        .single();

      const { error } = await supabase
        .from("queue")
        .update({
          status: "waiting",
          called_by: null,
          room_id: null,
          called_at: null,
          skip_count: (data?.skip_count ?? 0) + 1,
        })
        .eq("id", queueId)
        .eq("status", "in_progress");

      if (error) {
        return NextResponse.json({ error: "Failed to skip" }, { status: 500 });
      }
      return NextResponse.json({ success: true });
    }

    case "recall": {
      const { queueId, doctorId, roomNumber } = body;
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
      return NextResponse.json({ success: true });
    }

    case "mark_done": {
      const { queueId } = body;
      const { error } = await supabase
        .from("queue")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", queueId)
        .eq("status", "in_progress");

      if (error) {
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

    case "get_analytics": {
      const today = format(new Date(), "yyyy-MM-dd");
      const { data: completed } = await supabase
        .from("queue")
        .select("called_at, completed_at")
        .eq("status", "completed")
        .gte("called_at", `${today}T00:00:00`)
        .not("completed_at", "is", null);

      let avgMinutes = 10;
      if (completed?.length) {
        const total = completed.reduce((sum, row) => {
          const start = new Date(row.called_at!).getTime();
          const end = new Date(row.completed_at!).getTime();
          return sum + (end - start) / 60000;
        }, 0);
        avgMinutes = Math.round(total / completed.length);
      }

      const { count: waiting } = await supabase
        .from("queue")
        .select("*", { count: "exact", head: true })
        .eq("status", "waiting")
        .gte("created_at", `${today}T00:00:00`);

      const chartDays = Array.from({ length: 7 }, (_, i) => {
        const d = subDays(new Date(), 6 - i);
        return format(d, "yyyy-MM-dd");
      });

      const chartData = await Promise.all(
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
        chart: chartData,
      });
    }

    case "reset_daily": {
      if (auth.session.staff.role !== "admin") {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
      }
      const today = format(new Date(), "yyyy-MM-dd");
      const { data } = await supabase
        .from("queue")
        .update({ status: "cancelled" })
        .eq("status", "waiting")
        .gte("created_at", `${today}T00:00:00`)
        .select("id");
      return NextResponse.json({ success: true, cancelled: data?.length ?? 0 });
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}

import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { getClientIp } from "@/lib/rate-limit";
import { CAREQ_DEFAULT_THEME_COLOR } from "@/lib/design-tokens";
import { getClinicDayEndIso, getClinicDayStartIso } from "@/lib/datetime";
import { getAvgServiceTime } from "@/lib/services/queue-metrics";

export const dynamic = "force-dynamic";

const DEFAULT_DISPLAY = {
  display_name: "CAREQ",
  location: "",
  theme_color: CAREQ_DEFAULT_THEME_COLOR,
  show_wait_time: true,
  show_priority: true,
};

type QueueRow = {
  id: number;
  queue_number: string;
  status: string;
  priority?: string;
  room_id: number | null;
  skip_count?: number;
  called_at: string | null;
};

export async function GET(request: Request) {
  const supabase = createAdminClient();
  const dayStart = getClinicDayStartIso();
  const dayEnd = getClinicDayEndIso();
  const screenId = new URL(request.url).searchParams.get("screenId");

  let display = { ...DEFAULT_DISPLAY };
  if (screenId) {
    const screenIdNum = parseInt(screenId, 10);
    const { data: screen } = await supabase
      .from("display_settings")
      .select("display_name, location, theme_color, show_wait_time, show_priority, is_active")
      .eq("id", Number.isNaN(screenIdNum) ? screenId : screenIdNum)
      .maybeSingle();
    if (screen?.is_active) {
      display = {
        display_name: screen.display_name,
        location: screen.location,
        theme_color: screen.theme_color ?? CAREQ_DEFAULT_THEME_COLOR,
        show_wait_time: screen.show_wait_time ?? true,
        show_priority: screen.show_priority ?? true,
      };
    }
  }

  const [{ data: roomRows }, { data: queueRows }] = await Promise.all([
    supabase.from("rooms").select("id, name, description").eq("is_active", true).order("name"),
    supabase
      .from("queue")
      .select("id, queue_number, status, priority, room_id, skip_count, called_at, checkins!inner(checkin_id)")
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .in("status", ["waiting", "in_progress"])
      .order("skip_count", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  const items = (queueRows ?? []) as QueueRow[];

  const avgServiceTime = await getAvgServiceTime(dayStart, dayEnd);

  const inProgressByRoom = new Map<number, { queue_number: string }>();
  for (const item of items.filter((q) => q.status === "in_progress")) {
    if (item.room_id != null) {
      inProgressByRoom.set(Number(item.room_id), { queue_number: item.queue_number });
    }
  }

  const rooms = (roomRows ?? []).map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description ?? undefined,
    current: inProgressByRoom.get(room.id) ?? null,
  }));

  const waitingMapped = items
    .filter((q) => q.status === "waiting")
    .map((q, i) => ({
      id: q.queue_number,
      queueId: q.id,
      queue_number: q.queue_number,
      priority: q.priority ?? "normal",
      position: i + 1,
      est_wait_minutes: (i + 1) * avgServiceTime,
    }));

  const nowServing = items
    .filter((q) => q.status === "in_progress")
    .map((q) => ({
      id: q.queue_number,
      queueId: q.id,
      queue_number: q.queue_number,
      room_id: q.room_id,
      status: q.status,
    }));

  return NextResponse.json({
    success: true,
    display,
    rooms,
    nowServing,
    waiting: waitingMapped,
    avg_service_time: avgServiceTime,
  });
}

export async function POST(request: Request) {
  const auth = await requireStaff();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  if (!body.auto) {
    return NextResponse.json({ error: "Missing auto flag" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data: inProgress } = await supabase
    .from("queue")
    .select("id, called_at")
    .eq("status", "in_progress")
    .not("called_at", "is", null);

  const now = Date.now();
  const toComplete: number[] = [];

  for (const row of inProgress ?? []) {
    const calledAt = new Date(row.called_at!).getTime();
    const minutes = (now - calledAt) / 60000;
    if (minutes > 20) {
      toComplete.push(row.id);
    }
  }

  let updated = 0;
  if (toComplete.length) {
    const { data } = await supabase
      .from("queue")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .in("id", toComplete)
      .select("id");
    updated = data?.length ?? 0;

    if (data?.length) {
      const ip = getClientIp(request);
      const userId = auth.session.userId;
      await Promise.all(
        data.map((row) =>
          logAudit({
            userId,
            action: "queue_auto_complete",
            tableName: "queue",
            recordId: row.id,
            newValues: { status: "completed", reason: "stale_20min" },
            ipAddress: ip,
          })
        )
      );
    }
  }

  return NextResponse.json({ success: true, updated_records: updated });
}

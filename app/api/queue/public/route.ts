import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { withRateLimit } from "@/lib/api/with-auth";
import { getClientIp } from "@/lib/rate-limit";
import { CAREQ_DEFAULT_THEME_COLOR } from "@/lib/design-tokens";
import { getClinicDayEndIso, getClinicDayStartIso, getClinicTodayYmd } from "@/lib/datetime";
import { getAvgServiceTime } from "@/lib/services/queue-metrics";
import { completeQueueEntries } from "@/lib/services/queue.service";
import { isCalledLikeStatus } from "@/lib/queue-status";

export const dynamic = "force-dynamic";

/** Matches QueueBoard UI slice for the upcoming list. */
const WAITING_BOARD_LIMIT = 6;

const DEFAULT_DISPLAY = {
  display_name: "CAREQ",
  location: "",
  theme_color: CAREQ_DEFAULT_THEME_COLOR,
  show_wait_time: true,
  show_priority: true,
};

type StaffName = { first_name: string; last_name: string };

type QueueRow = {
  id: number;
  queue_number: string;
  status: string;
  priority?: string;
  room_id: number | null;
  skip_count?: number;
  called_at: string | null;
  checkins?: unknown;
};

function formatDoctorName(staff: StaffName | null | undefined): string | undefined {
  if (!staff?.first_name) return undefined;
  const last = staff.last_name?.trim();
  return last ? `Dr. ${staff.last_name}` : `Dr. ${staff.first_name}`;
}

function doctorNameFromQueueRow(row: QueueRow): string | undefined {
  const checkinRaw = row.checkins;
  const checkin = (Array.isArray(checkinRaw) ? checkinRaw[0] : checkinRaw) as
    | { staff?: StaffName | StaffName[] | null }
    | null
    | undefined;
  const staffRaw = checkin?.staff;
  const staff = (Array.isArray(staffRaw) ? staffRaw[0] : staffRaw) as
    | StaffName
    | null
    | undefined;
  return formatDoctorName(staff);
}

export const GET = withRateLimit(
  "queue_public",
  async (request: Request) => {
  const supabase = createAdminClient();
  const today = getClinicTodayYmd();
  const dayStart = getClinicDayStartIso(today);
  const dayEnd = getClinicDayEndIso(today);
  const screenId = new URL(request.url).searchParams.get("screenId");
  const screenIdNum = screenId != null ? parseInt(screenId, 10) : NaN;

  const screenQuery =
    screenId != null
      ? supabase
          .from("display_settings")
          .select("display_name, location, theme_color, show_wait_time, show_priority, is_active")
          .eq("id", Number.isNaN(screenIdNum) ? screenId : screenIdNum)
          .maybeSingle()
      : Promise.resolve({ data: null as null });

  // Doctor name only — no patient PII on the public TV board
  const queueSelect =
    "id, queue_number, status, priority, room_id, skip_count, called_at, checkins!inner(checkin_id, staff:doctor_id(first_name, last_name))";

  const [
    { data: screen },
    { data: roomRows },
    { data: occupiedRows },
    { data: waitingRows },
    avgServiceTime,
  ] = await Promise.all([
    screenQuery,
    supabase.from("rooms").select("id, name, description").eq("is_active", true).order("name"),
    // All occupied rooms for today — no limit (every room card must be accurate)
    supabase
      .from("queue")
      .select(queueSelect)
      .eq("clinic_date", today)
      .in("status", ["in_progress", "called"])
      .order("skip_count", { ascending: true })
      .order("id", { ascending: true }),
    // Only the upcoming list the TV board displays
    supabase
      .from("queue")
      .select(queueSelect)
      .eq("clinic_date", today)
      .eq("status", "waiting")
      .order("skip_count", { ascending: true })
      .order("id", { ascending: true })
      .limit(WAITING_BOARD_LIMIT),
    getAvgServiceTime(dayStart, dayEnd, supabase),
  ]);

  let display = { ...DEFAULT_DISPLAY };
  if (screen?.is_active) {
    display = {
      display_name: screen.display_name,
      location: screen.location,
      theme_color: screen.theme_color ?? CAREQ_DEFAULT_THEME_COLOR,
      show_wait_time: screen.show_wait_time ?? true,
      show_priority: screen.show_priority ?? true,
    };
  }

  const occupied = (occupiedRows ?? []) as QueueRow[];
  const waiting = (waitingRows ?? []) as QueueRow[];

  const inProgressByRoom = new Map<
    number,
    { queue_number: string; status: string; doctor_name?: string }
  >();
  for (const item of occupied.filter((q) => isCalledLikeStatus(q.status))) {
    if (item.room_id != null) {
      inProgressByRoom.set(Number(item.room_id), {
        queue_number: item.queue_number,
        status: item.status,
        doctor_name: doctorNameFromQueueRow(item),
      });
    }
  }

  const rooms = (roomRows ?? []).map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description ?? undefined,
    current: inProgressByRoom.get(room.id) ?? null,
  }));

  const waitingMapped = waiting.map((q, i) => ({
    id: q.queue_number,
    queueId: q.id,
    queue_number: q.queue_number,
    priority: q.priority ?? "normal",
    position: i + 1,
    est_wait_minutes: (i + 1) * avgServiceTime,
  }));

  const nowServing = occupied
    .filter((q) => isCalledLikeStatus(q.status))
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
  },
  { max: 120, windowSeconds: 60, failClosed: true }
);

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
  const today = getClinicTodayYmd();
  const { data: inProgress } = await supabase
    .from("queue")
    .select("id, called_at")
    .eq("clinic_date", today)
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
    updated = await completeQueueEntries(toComplete);

    if (updated) {
      const ip = getClientIp(request);
      const userId = auth.session.userId;
      await Promise.all(
        toComplete.map((id) =>
          logAudit({
            userId,
            action: "queue_auto_complete",
            tableName: "queue",
            recordId: id,
            newValues: { status: "completed", reason: "stale_20min" },
            ipAddress: ip,
          })
        )
      );
    }
  }

  return NextResponse.json({ success: true, updated_records: updated });
}

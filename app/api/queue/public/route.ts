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
  called_by_staff?: unknown;
  checkins?: unknown;
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
      .select(
        `id, queue_number, status, priority, room_id, skip_count, called_at,
         called_by_staff:called_by(first_name, last_name),
         checkins!inner(
           checkin_id,
           patients(first_name, last_name),
           appointment_types(name),
           staff:doctor_id(first_name, last_name)
         )`
      )
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .in("status", ["waiting", "in_progress"])
      .order("skip_count", { ascending: true })
      .order("id", { ascending: true }),
  ]);

  const items = (queueRows ?? []) as QueueRow[];

  const avgServiceTime = await getAvgServiceTime(dayStart, dayEnd);

  const mapServing = (item: QueueRow) => {
    const checkinRaw = item.checkins;
    const checkin = (Array.isArray(checkinRaw) ? checkinRaw[0] : checkinRaw) as {
      patients?: unknown;
      appointment_types?: unknown;
      staff?: unknown;
    } | null;

    const patientRaw = checkin?.patients;
    const patient = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as
      | { first_name: string; last_name: string }
      | null
      | undefined;

    const calledByRaw = item.called_by_staff;
    const calledBy = (Array.isArray(calledByRaw) ? calledByRaw[0] : calledByRaw) as
      | { first_name: string; last_name: string }
      | null
      | undefined;

    const checkinDoctorRaw = checkin?.staff;
    const checkinDoctor = (Array.isArray(checkinDoctorRaw) ? checkinDoctorRaw[0] : checkinDoctorRaw) as
      | { first_name: string; last_name: string }
      | null
      | undefined;

    const doctorSource =
      item.status === "in_progress" && calledBy ? calledBy : checkinDoctor;

    return {
      queue_number: item.queue_number,
      name: patient ? `${patient.first_name} ${patient.last_name}` : "",
      doctor: doctorSource
        ? `Dr. ${doctorSource.first_name} ${doctorSource.last_name}`
        : "",
    };
  };

  const inProgressByRoom = new Map<number, ReturnType<typeof mapServing>>();
  for (const item of items.filter((q) => q.status === "in_progress")) {
    if (item.room_id != null) {
      inProgressByRoom.set(Number(item.room_id), mapServing(item));
    }
  }

  const rooms = (roomRows ?? []).map((room) => ({
    id: room.id,
    name: room.name,
    description: room.description ?? undefined,
    current: inProgressByRoom.get(room.id) ?? null,
  }));

  const waiting = items.filter((q) => q.status === "waiting");

  const mapWaiting = (item: QueueRow, pos: number) => {
    const base = mapServing(item);
    return {
      id: item.queue_number,
      queueId: item.id,
      ...base,
      reason: "",
      status: item.status,
      priority: item.priority ?? "normal",
      position: pos,
      est_wait_minutes: pos * avgServiceTime,
    };
  };

  const waitingMapped = waiting.map((q, i) => {
    const checkinRaw = q.checkins;
    const checkin = (Array.isArray(checkinRaw) ? checkinRaw[0] : checkinRaw) as {
      appointment_types?: unknown;
    } | null;
    const apptTypeRaw = checkin?.appointment_types;
    const apptType = (Array.isArray(apptTypeRaw) ? apptTypeRaw[0] : apptTypeRaw) as
      | { name: string }
      | null
      | undefined;
    const row = mapWaiting(q, i + 1);
    return { ...row, reason: apptType?.name ?? "" };
  });

  const nowServing = items
    .filter((q) => q.status === "in_progress")
    .map((q) => ({
      id: q.queue_number,
      queueId: q.id,
      ...mapServing(q),
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

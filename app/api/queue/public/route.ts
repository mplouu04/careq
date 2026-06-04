import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { CAREQ_DEFAULT_THEME_COLOR } from "@/lib/design-tokens";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

const DEFAULT_DISPLAY = {
  display_name: "CAREQ",
  location: "",
  theme_color: CAREQ_DEFAULT_THEME_COLOR,
  show_wait_time: true,
  show_priority: true,
};

/**
 * GET /api/queue/public?screenId=
 * Returns today's now-serving (in_progress) and upcoming (waiting) rows.
 * Optional screenId loads display_settings for TV theming.
 */
export async function GET(request: Request) {
  const supabase = createAdminClient();
  const today = format(new Date(), "yyyy-MM-dd");
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

  const { data } = await supabase
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
    .gte("created_at", `${today}T00:00:00`)
    .in("status", ["waiting", "in_progress"])
    .order("skip_count", { ascending: true })
    .order("id", { ascending: true });

  const items = data ?? [];

  // Calculate average service time for estimated wait
  const { data: completed } = await supabase
    .from("queue")
    .select("called_at, completed_at")
    .eq("status", "completed")
    .gte("called_at", `${today}T00:00:00`)
    .not("completed_at", "is", null);

  let avgServiceTime = 10;
  if (completed?.length) {
    const total = completed.reduce((sum, row) => {
      const start = new Date(row.called_at!).getTime();
      const end = new Date(row.completed_at!).getTime();
      return sum + (end - start) / 60000;
    }, 0);
    avgServiceTime = Math.round(total / completed.length) || 10;
  }

  const mapItem = (item: (typeof items)[0], pos?: number) => {
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

    const apptTypeRaw = checkin?.appointment_types;
    const apptType = (Array.isArray(apptTypeRaw) ? apptTypeRaw[0] : apptTypeRaw) as
      | { name: string }
      | null
      | undefined;

    // For in_progress entries use the doctor who actually called the patient (called_by).
    // For waiting entries fall back to the appointment-assigned doctor from the checkin.
    const calledByRaw = (item as Record<string, unknown>).called_by_staff;
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
      id: item.queue_number,
      queueId: item.id,
      name: patient ? `${patient.first_name} ${patient.last_name}` : "",
      doctor: doctorSource
        ? `Dr. ${doctorSource.first_name} ${doctorSource.last_name}`
        : "",
      room: item.room_id ?? "",
      reason: apptType?.name ?? "",
      status: item.status,
      priority: (item as { priority?: string }).priority ?? "normal",
      called_at: item.called_at,
      ...(pos !== undefined
        ? { position: pos, est_wait_minutes: pos * avgServiceTime }
        : {}),
    };
  };

  const waiting = items.filter((q) => q.status === "waiting");
  const nowServing = items.filter((q) => q.status === "in_progress");

  return NextResponse.json({
    success: true,
    display,
    nowServing: nowServing.map((q) => mapItem(q)),
    waiting: waiting.map((q, i) => mapItem(q, i + 1)),
    avg_service_time: avgServiceTime,
  });
}

/**
 * POST /api/queue/public  (body: { auto: true })
 * Auto-completes in_progress queue entries that have been calling for > 20 minutes.
 * Staff-only: requires valid session to prevent unauthenticated state mutations.
 */
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
  }

  return NextResponse.json({ success: true, updated_records: updated });
}

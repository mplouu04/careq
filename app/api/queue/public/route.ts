import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

/**
 * GET /api/queue/public
 * Returns today's now-serving (in_progress) and upcoming (waiting) rows.
 * Used by the public TV queue board.
 *
 * Also handles POST ?auto=1 — marks in_progress rows older than 20 minutes as completed.
 */
export async function GET() {
  const supabase = createAdminClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data } = await supabase
    .from("queue")
    .select(
      `id, queue_number, status, room_id, skip_count, called_at,
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

    const doctorRaw = checkin?.staff;
    const doctor = (Array.isArray(doctorRaw) ? doctorRaw[0] : doctorRaw) as
      | { first_name: string; last_name: string }
      | null
      | undefined;

    return {
      id: item.queue_number,
      queueId: item.id,
      name: patient ? `${patient.first_name} ${patient.last_name}` : "",
      doctor: doctor
        ? `Dr. ${doctor.first_name} ${doctor.last_name}`
        : "",
      room: item.room_id ?? "",
      reason: apptType?.name ?? "",
      status: item.status,
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

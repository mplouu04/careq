import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

/**
 * Calculate today's average service time in minutes.
 * Default = 10 when no completed records exist.
 */
async function getAvgServiceTime(): Promise<number> {
  const supabase = createAdminClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data: completed } = await supabase
    .from("queue")
    .select("called_at, completed_at")
    .eq("status", "completed")
    .gte("called_at", `${today}T00:00:00`)
    .not("completed_at", "is", null)
    .not("called_at", "is", null);

  if (!completed?.length) return 10;

  const total = completed.reduce((sum, row) => {
    const start = new Date(row.called_at!).getTime();
    const end = new Date(row.completed_at!).getTime();
    return sum + (end - start) / 60000;
  }, 0);

  return Math.round(total / completed.length) || 10;
}

/**
 * GET /api/queue
 *
 * Public (with ?ref=): returns status for a single queue entry (by queue_number or reference_number).
 * Staff (no ref): returns today's active queue, ordered skip_count ASC, id ASC.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref")?.toUpperCase();
  const today = format(new Date(), "yyyy-MM-dd");
  const supabase = createAdminClient();

  // ── Public single-entry lookup ─────────────────────────────────────────────
  if (ref) {
    const { data: entry } = await supabase
      .from("queue")
      .select(
        `id, queue_number, status, priority, called_at, room_id, skip_count, created_at,
         checkins!inner(
           checkin_id, reference_number, reason, type_id,
           patients(first_name, last_name),
           appointment_types(name),
           staff:doctor_id(first_name, last_name)
         )`
      )
      .or(`queue_number.eq.${ref},checkins.reference_number.eq.${ref}`)
      .gte("created_at", `${today}T00:00:00`)
      .maybeSingle();

    if (!entry) {
      return NextResponse.json({ success: false, error: "Queue entry not found" });
    }

    // Position and wait time
    let position: number | null = null;
    let estWaitMinutes: number | null = null;

    if (entry.status === "waiting") {
      const { data: allWaiting } = await supabase
        .from("queue")
        .select("id, skip_count")
        .eq("status", "waiting")
        .gte("created_at", `${today}T00:00:00`)
        .order("skip_count", { ascending: true })
        .order("id", { ascending: true });

      const waiting = allWaiting ?? [];
      const pos = waiting.findIndex((q) => q.id === entry.id) + 1;
      if (pos > 0) {
        const avg = await getAvgServiceTime();
        position = pos;
        estWaitMinutes = pos * avg;
      }
    }

    return NextResponse.json({
      success: true,
      queue: entry,
      position,
      est_wait_minutes: estWaitMinutes,
    });
  }

  // ── Staff dashboard queue ──────────────────────────────────────────────────
  const auth = await requireStaff();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: allRows } = await supabase
    .from("queue")
    .select(
      `id, queue_number, status, priority, called_at, room_id, skip_count, created_at,
       checkins!inner(
         checkin_id, reference_number, reason, type_id,
         patients(first_name, last_name),
         appointment_types(name),
         staff:doctor_id(first_name, last_name)
       )`
    )
    .gte("created_at", `${today}T00:00:00`)
    .order("skip_count", { ascending: true })
    .order("id", { ascending: true });

  const rows = allRows ?? [];
  const avgServiceTime = await getAvgServiceTime();

  let waitingPosition = 0;
  const waiting = [];
  const inProgress = [];
  const completed = [];

  for (const row of rows) {
    const checkinRaw = Array.isArray(row.checkins) ? row.checkins[0] : row.checkins;
    const patientRaw = checkinRaw?.patients;
    const patient = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as
      | { first_name: string; last_name: string }
      | null
      | undefined;
    const apptTypeRaw = checkinRaw?.appointment_types;
    const apptType = (Array.isArray(apptTypeRaw) ? apptTypeRaw[0] : apptTypeRaw) as
      | { name: string }
      | null
      | undefined;
    const doctorRaw = checkinRaw?.staff;
    const doctor = (Array.isArray(doctorRaw) ? doctorRaw[0] : doctorRaw) as
      | { first_name: string; last_name: string }
      | null
      | undefined;

    const name = patient ? `${patient.first_name} ${patient.last_name}` : "";
    const reason = apptType?.name ?? checkinRaw?.reason ?? "";

    if (row.status === "waiting") {
      waitingPosition++;
      waiting.push({
        id: row.queue_number,
        queueId: row.id,
        name,
        time: row.created_at
          ? format(new Date(row.created_at), "hh:mm a")
          : "",
        priority: row.priority,
        reason,
        position: waitingPosition,
        est_wait_minutes: waitingPosition * avgServiceTime,
        skip_count: row.skip_count ?? 0,
      });
    } else if (row.status === "in_progress") {
      inProgress.push({
        id: row.queue_number,
        queueId: row.id,
        name,
        time: row.called_at ? format(new Date(row.called_at), "hh:mm a") : "",
        doctor: doctor ? `Dr. ${doctor.first_name} ${doctor.last_name}` : "",
        room: row.room_id ?? "",
      });
    } else if (row.status === "completed") {
      completed.push({
        id: row.queue_number,
        queueId: row.id,
        name,
        time: row.created_at
          ? format(new Date(row.created_at), "hh:mm a")
          : "",
      });
    }
  }

  return NextResponse.json({
    success: true,
    appointment: { waiting, inProgress, completed, avg_service_time: avgServiceTime },
    queue: rows,
  });
}

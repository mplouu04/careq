import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api/with-auth";
import { getAvgServiceTime } from "@/lib/services/queue-metrics";
import { maskPatientName } from "@/lib/services/patient.service";
import { format } from "date-fns";
import { getClinicDayEndIso, getClinicDayStartIso, getClinicTodayYmd } from "@/lib/datetime";
import { normalizeQueueRef } from "@/lib/queue-ref";
import { requireStaff } from "@/lib/auth";
import { captureException } from "@/lib/observability";
import { isCalledLikeStatus } from "@/lib/queue-status";
import { getRoomNameMap, resolveRoomName } from "@/lib/rooms-map";

export const dynamic = "force-dynamic";

function sanitizeCheckinForPublic(checkin: Record<string, unknown>): Record<string, unknown> {
  const patientRaw = checkin.patients;
  const patient = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as
    | { first_name: string; last_name: string }
    | null
    | undefined;
  return {
    checkin_id: checkin.checkin_id,
    reference_number: checkin.reference_number,
    type_id: checkin.type_id,
    appointment_types: checkin.appointment_types,
    ...(patient
      ? { patients: { name: maskPatientName(patient.first_name, patient.last_name) } }
      : {}),
    // staff and reason intentionally omitted — doctor name is in top-level `doctor` field
  };
}

function sanitizeQueueEntryForPublic(entry: Record<string, unknown>): Record<string, unknown> {
  const checkinsRaw = entry.checkins;
  const rest = { ...entry };
  delete rest.called_by_staff;
  const sanitizedCheckins = !checkinsRaw
    ? undefined
    : Array.isArray(checkinsRaw)
      ? checkinsRaw.map((c) => sanitizeCheckinForPublic(c as Record<string, unknown>))
      : sanitizeCheckinForPublic(checkinsRaw as Record<string, unknown>);
  return {
    ...rest,
    ...(sanitizedCheckins !== undefined ? { checkins: sanitizedCheckins } : {}),
  };
}

/**
 * GET /api/queue
 *
 * Public (with ?ref=): returns status for a single queue entry (by queue_number or reference_number).
 * Staff (no ref): returns today's active queue, ordered skip_count ASC, id ASC.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const refRaw = searchParams.get("ref");

  if (refRaw) {
    return withRateLimit(
      "queue_status",
      () => publicQueueRefHandler(request),
      { max: 60, windowSeconds: 60, failClosed: true }
    )(request);
  }

  return staffQueueHandler();
}

async function publicQueueRefHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const refRaw = searchParams.get("ref");
  if (!refRaw) {
    return NextResponse.json({ success: false, error: "Missing ref" }, { status: 400 });
  }

  const today = getClinicTodayYmd();
  const dayStart = getClinicDayStartIso(today);
  const dayEnd = getClinicDayEndIso(today);
  const supabase = createAdminClient();
  const ref = normalizeQueueRef(refRaw);
  const queueSelect = `id, queue_number, status, priority, called_at, room_id, skip_count, created_at,
         called_by_staff:called_by(first_name, last_name),
         checkins!inner(
           checkin_id, reference_number, reason, type_id,
           patients(first_name, last_name),
           appointment_types(name),
           staff:doctor_id(first_name, last_name)
         )`;

  const [byNumberRes, byRefRes, roomMap] = await Promise.all([
    supabase
      .from("queue")
      .select(queueSelect)
      .eq("queue_number", ref)
      .eq("clinic_date", today)
      .maybeSingle(),
    supabase
      .from("checkins")
      .select("checkin_id")
      .eq("reference_number", ref)
      .maybeSingle(),
    getRoomNameMap(supabase),
  ]);

  if (byNumberRes.error) {
    captureException(byNumberRes.error, { route: "/api/queue", ref });
    return NextResponse.json(
      { success: false, error: "Failed to load queue status" },
      { status: 500 }
    );
  }
  if (byRefRes.error) {
    captureException(byRefRes.error, { route: "/api/queue", ref });
    return NextResponse.json(
      { success: false, error: "Failed to load queue status" },
      { status: 500 }
    );
  }

  let entry = byNumberRes.data;
  if (!entry && byRefRes.data) {
    const entryByCheckinRes = await supabase
      .from("queue")
      .select(queueSelect)
      .eq("checkin_id", byRefRes.data.checkin_id)
      .eq("clinic_date", today)
      .maybeSingle();
    if (entryByCheckinRes.error) {
      captureException(entryByCheckinRes.error, { route: "/api/queue", ref });
      return NextResponse.json(
        { success: false, error: "Failed to load queue status" },
        { status: 500 }
      );
    }
    entry = entryByCheckinRes.data;
  }

  if (!entry) {
    return NextResponse.json(
      { success: false, error: "Queue entry not found" },
      { status: 404 }
    );
  }

  let position: number | null = null;
  let estWaitMinutes: number | null = null;
  let patientsAhead: number | null = null;

  if (entry.status === "waiting") {
    const [posRes, avg] = await Promise.all([
      supabase.rpc("get_queue_waiting_position", {
        p_queue_id: entry.id,
        p_day_start: dayStart,
        p_day_end: dayEnd,
      }),
      getAvgServiceTime(dayStart, dayEnd, supabase),
    ]);

    if (posRes.error) {
      captureException(posRes.error, { route: "/api/queue", ref, queueId: entry.id });
    } else {
      const resolvedPos = typeof posRes.data === "number" ? posRes.data : 0;
      if (resolvedPos > 0) {
        position = resolvedPos;
        patientsAhead = resolvedPos - 1;
        estWaitMinutes = resolvedPos * avg;
      }
    }
  }

  const calledByRaw = (entry as Record<string, unknown>).called_by_staff;
  const calledBy = (Array.isArray(calledByRaw) ? calledByRaw[0] : calledByRaw) as
    | { first_name: string; last_name: string }
    | null
    | undefined;

  return NextResponse.json({
    success: true,
    queue: sanitizeQueueEntryForPublic(entry as Record<string, unknown>),
    position,
    patients_ahead: patientsAhead,
    est_wait_minutes: estWaitMinutes,
    doctor: calledBy ? `Dr. ${calledBy.first_name} ${calledBy.last_name}` : "",
    room: resolveRoomName(entry.room_id, roomMap),
  });
}

async function staffQueueHandler() {
  const today = getClinicTodayYmd();
  const dayStart = getClinicDayStartIso(today);
  const dayEnd = getClinicDayEndIso(today);
  const supabase = createAdminClient();

  const auth = await requireStaff();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Round-trip 1: rooms, queue join, and avg service time all fire in parallel
  const [roomMap, queueRes, avgServiceTime] = await Promise.all([
    getRoomNameMap(supabase),
    supabase
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
      .eq("clinic_date", today)
      .order("skip_count", { ascending: true })
      .order("id", { ascending: true }),
    getAvgServiceTime(dayStart, dayEnd, supabase),
  ]);

  if (queueRes.error) {
    captureException(queueRes.error, { route: "/api/queue" });
    return NextResponse.json({ error: "Failed to load queue" }, { status: 500 });
  }

  const rows = queueRes.data ?? [];

  let waitingPosition = 0;
  const waiting = [];
  const inProgress = [];
  const completed = [];
  const noShow = [];

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
    const visitType = apptType?.name ?? "";
    const reason = (checkinRaw?.reason as string | null | undefined) ?? "";

    if (row.status === "waiting") {
      waitingPosition++;
      waiting.push({
        id: row.queue_number,
        queueId: row.id,
        queue_number: row.queue_number,
        name,
        time: row.created_at
          ? format(new Date(row.created_at), "hh:mm a")
          : "",
        priority: row.priority,
        visitType,
        reason,
        position: waitingPosition,
        est_wait_minutes: waitingPosition * avgServiceTime,
        skip_count: row.skip_count ?? 0,
      });
    } else if (isCalledLikeStatus(row.status)) {
      inProgress.push({
        id: row.queue_number,
        queueId: row.id,
        queue_number: row.queue_number,
        name,
        time: row.called_at ? format(new Date(row.called_at), "hh:mm a") : "",
        doctor: doctor ? `Dr. ${doctor.first_name} ${doctor.last_name}` : "",
        room: resolveRoomName(row.room_id, roomMap),
      });
    } else if (row.status === "no_show") {
      noShow.push({
        id: row.queue_number,
        queueId: row.id,
        queue_number: row.queue_number,
        name,
        time: row.created_at
          ? format(new Date(row.created_at), "hh:mm a")
          : "",
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
    appointment: {
      waiting,
      inProgress,
      completed,
      noShow,
      avg_service_time: avgServiceTime,
    },
  });
}

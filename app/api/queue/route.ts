import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api/with-auth";
import { getAvgServiceTime } from "@/lib/services/queue-metrics";
import { maskPatientName } from "@/lib/services/patient.service";
import { getClinicDayEndIso, getClinicDayStartIso, getClinicTodayYmd } from "@/lib/datetime";
import { normalizeQueueRef } from "@/lib/queue-ref";
import { requireStaff } from "@/lib/auth";
import { captureException } from "@/lib/observability";
import { getRoomNameMap, resolveRoomName } from "@/lib/rooms-map";
import { listStaffQueue } from "@/lib/services/queue-read.service";
import { isUpcomingBookedCheckin } from "@/lib/queue-status";

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
      .select("checkin_id, status, approval_status, appointment_date, scheduled_time")
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
    // Valid appointment reference with no queue entry yet (future date, or not checked in today).
    // Return only the visit date/time, never patient or doctor details.
    const booked = byRefRes.data as
      | {
          status: string;
          approval_status?: string | null;
          appointment_date?: string | null;
          scheduled_time?: string | null;
        }
      | null;
    if (booked?.approval_status === "rejected") {
      return NextResponse.json({ success: true, not_approved: true });
    }
    if (booked && isUpcomingBookedCheckin(booked, today)) {
      const visitDate = (booked.appointment_date ?? "").slice(0, 10);
      return NextResponse.json({
        success: true,
        scheduled: {
          appointment_date: visitDate,
          scheduled_time: booked.scheduled_time ?? null,
          is_today: visitDate === today,
          awaiting_approval: booked.approval_status === "pending",
        },
      });
    }
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

  const checkinRaw = (entry as Record<string, unknown>).checkins;
  const checkin = (Array.isArray(checkinRaw) ? checkinRaw[0] : checkinRaw) as
    | { staff?: { first_name: string; last_name: string } | { first_name: string; last_name: string }[] | null }
    | null
    | undefined;
  const assignedStaffRaw = checkin?.staff;
  const assignedStaff = (Array.isArray(assignedStaffRaw)
    ? assignedStaffRaw[0]
    : assignedStaffRaw) as { first_name: string; last_name: string } | null | undefined;

  const doctorName = calledBy
    ? `Dr. ${calledBy.first_name} ${calledBy.last_name}`
    : assignedStaff
      ? `Dr. ${assignedStaff.first_name} ${assignedStaff.last_name}`
      : "";

  return NextResponse.json({
    success: true,
    queue: sanitizeQueueEntryForPublic(entry as Record<string, unknown>),
    position,
    patients_ahead: patientsAhead,
    est_wait_minutes: estWaitMinutes,
    doctor: doctorName,
    room: resolveRoomName(entry.room_id, roomMap),
  });
}

async function staffQueueHandler() {
  const auth = await requireStaff();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Identity/role from verified session only — never from query/body.
  const { appointment, error } = await listStaffQueue({
    role: auth.session.staff.role,
    staffId: auth.session.staff.id,
  });

  if (error) {
    captureException(error, { route: "/api/queue" });
    return NextResponse.json({ error: "Failed to load queue" }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    appointment,
  });
}

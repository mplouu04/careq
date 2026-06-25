import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAvgServiceTime } from "@/lib/services/queue-metrics";
import { maskPatientName } from "@/lib/services/patient.service";
import { format } from "date-fns";
import { getClinicDayEndIso, getClinicDayStartIso } from "@/lib/datetime";
import { normalizeQueueRef } from "@/lib/queue-ref";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

async function getRoomNameMap(supabase: SupabaseClient): Promise<Map<number, string>> {
  try {
    const { data } = await supabase.from("rooms").select("id, name").eq("is_active", true);
    const map = new Map<number, string>();
    for (const r of data ?? []) {
      map.set(r.id, r.name);
    }
    return map;
  } catch {
    return new Map();
  }
}

function resolveRoomName(roomId: number | null | undefined, roomMap: Map<number, string>): string {
  if (roomId == null) return "";
  return roomMap.get(Number(roomId)) ?? `Room ${roomId}`;
}

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
  const { called_by_staff: _staff, checkins: checkinsRaw, ...rest } = entry;
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
  const dayStart = getClinicDayStartIso();
  const dayEnd = getClinicDayEndIso();
  const supabase = createAdminClient();

  // ── Public single-entry lookup ─────────────────────────────────────────────
  if (refRaw) {
    try {
      const ref = normalizeQueueRef(refRaw);
      const queueSelect = `id, queue_number, status, priority, called_at, room_id, skip_count, created_at,
           called_by_staff:called_by(first_name, last_name),
           checkins!inner(
             checkin_id, reference_number, reason, type_id,
             patients(first_name, last_name),
             appointment_types(name),
             staff:doctor_id(first_name, last_name)
           )`;

      // Round-trip 1: fire queue_number lookup and reference_number lookup in parallel
      const [{ data: byNumber }, { data: byRef }, roomMap] = await Promise.all([
        supabase
          .from("queue")
          .select(queueSelect)
          .eq("queue_number", ref)
          .gte("created_at", dayStart)
          .lte("created_at", dayEnd)
          .maybeSingle(),
        supabase
          .from("checkins")
          .select("checkin_id")
          .eq("reference_number", ref)
          .maybeSingle(),
        getRoomNameMap(supabase),
      ]);

      // Resolve entry: prefer direct queue_number hit; fall back to checkin_id lookup
      let entry = byNumber;
      if (!entry && byRef) {
        // Round-trip 2a: fetch queue row by checkin_id (now indexed via migration 014)
        const { data: entryByCheckin } = await supabase
          .from("queue")
          .select(queueSelect)
          .eq("checkin_id", byRef.checkin_id)
          .gte("created_at", dayStart)
          .lte("created_at", dayEnd)
          .maybeSingle();
        entry = entryByCheckin;
      }

      if (!entry) {
        return NextResponse.json({ success: false, error: "Queue entry not found" });
      }

      let position: number | null = null;
      let estWaitMinutes: number | null = null;
      let patientsAhead: number | null = null;

      if (entry.status === "waiting") {
        // Round-trip 2b (or 3 if checkin fallback was used): position scan + avg in parallel
        const [{ data: allWaiting }, avg] = await Promise.all([
          supabase
            .from("queue")
            .select("id, skip_count")
            .eq("status", "waiting")
            .gte("created_at", dayStart)
            .lte("created_at", dayEnd)
            .order("skip_count", { ascending: true })
            .order("id", { ascending: true }),
          getAvgServiceTime(dayStart, dayEnd, supabase),
        ]);

        const waiting = allWaiting ?? [];
        const pos = waiting.findIndex((q) => q.id === entry!.id) + 1;
        if (pos > 0) {
          position = pos;
          patientsAhead = pos - 1;
          estWaitMinutes = pos * avg;
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
    } catch {
      return NextResponse.json({ success: false, error: "Queue entry not found" });
    }
  }

  // ── Staff dashboard queue ──────────────────────────────────────────────────
  const auth = await requireStaff();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Round-trip 1: rooms, queue join, and avg service time all fire in parallel
  const [roomMap, { data: allRows }, avgServiceTime] = await Promise.all([
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
      .gte("created_at", dayStart)
      .lte("created_at", dayEnd)
      .order("skip_count", { ascending: true })
      .order("id", { ascending: true }),
    getAvgServiceTime(dayStart, dayEnd, supabase),
  ]);

  const rows = allRows ?? [];

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
    const reason = apptType?.name ?? checkinRaw?.reason ?? "";

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
        reason,
        position: waitingPosition,
        est_wait_minutes: waitingPosition * avgServiceTime,
        skip_count: row.skip_count ?? 0,
      });
    } else if (row.status === "in_progress") {
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
    queue: rows,
  });
}

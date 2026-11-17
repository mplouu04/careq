import { format } from "date-fns";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvgServiceTime } from "@/lib/services/queue-metrics";
import { getClinicDayEndIso, getClinicDayStartIso, getClinicTodayYmd } from "@/lib/datetime";
import { isCalledLikeStatus } from "@/lib/queue-status";
import { getRoomNameMap, resolveRoomName } from "@/lib/rooms-map";
import { getNoShowGraceMinutes } from "@/lib/clinic-settings";

export type QueueStaffViewer = {
  role: string;
  staffId: string;
};

const QUEUE_STAFF_SELECT = `id, queue_number, status, priority, called_at, present_at, room_id, skip_count, created_at, waiting_since,
         bp_systolic, bp_diastolic, temperature_c, triage_notes, assigned_doctor_id, called_by,
         checkins!inner(
           checkin_id, reference_number, reason, type_id, doctor_id,
           patients(first_name, last_name),
           appointment_types(name),
           staff:doctor_id(first_name, last_name)
         )`;

/**
 * Ownership for doctor reads (verified semantics):
 * - assigned_doctor_id: nurse triage / call assignment target
 * - checkins.doctor_id: booked / preferred doctor
 * called_by is who pressed Call — NOT treated as ownership alone.
 */
export function doctorOwnsQueueRow(
  staffId: string,
  row: {
    assigned_doctor_id?: string | null;
    checkins?: unknown;
  }
): boolean {
  const checkinRaw = Array.isArray(row.checkins) ? row.checkins[0] : row.checkins;
  const checkin = checkinRaw as { doctor_id?: string | null } | null | undefined;
  if (row.assigned_doctor_id && row.assigned_doctor_id === staffId) return true;
  if (checkin?.doctor_id && checkin.doctor_id === staffId) return true;
  return false;
}

/** Display assignment: triage/booking doctor — not called_by. */
export function resolveAssignedDoctorId(row: {
  assigned_doctor_id?: string | null;
  checkins?: unknown;
}): string | null {
  const checkinRaw = Array.isArray(row.checkins) ? row.checkins[0] : row.checkins;
  const checkin = checkinRaw as { doctor_id?: string | null } | null | undefined;
  return row.assigned_doctor_id ?? checkin?.doctor_id ?? null;
}

function mergeQueueRowsById(
  a: Record<string, unknown>[],
  b: Record<string, unknown>[]
): Record<string, unknown>[] {
  const map = new Map<number, Record<string, unknown>>();
  for (const row of [...a, ...b]) {
    const id = row.id as number;
    if (!map.has(id)) map.set(id, row);
  }
  return Array.from(map.values()).sort((x, y) => {
    const skip = (Number(x.skip_count) || 0) - (Number(y.skip_count) || 0);
    if (skip !== 0) return skip;
    const wx = String(x.waiting_since ?? x.created_at ?? "");
    const wy = String(y.waiting_since ?? y.created_at ?? "");
    if (wx !== wy) return wx < wy ? -1 : 1;
    return Number(x.id) - Number(y.id);
  });
}

/**
 * Strip any accidental sensitive patient fields before doctor responses.
 * Select already omits phone/DOB/address; this is defense in depth.
 */
export function sanitizeDoctorPatientFields(patient: Record<string, unknown> | null | undefined) {
  if (!patient) return null;
  return {
    first_name: patient.first_name ?? null,
    last_name: patient.last_name ?? null,
  };
}

export type StaffQueueAppointmentPayload = {
  waiting: unknown[];
  withNurse: unknown[];
  readyForDoctor: unknown[];
  inProgress: unknown[];
  completed: unknown[];
  noShow: unknown[];
  avg_service_time: number;
  no_show_grace_minutes: number;
};

export async function listStaffQueue(viewer: QueueStaffViewer): Promise<{
  appointment: StaffQueueAppointmentPayload;
  error: unknown | null;
}> {
  const today = getClinicTodayYmd();
  const dayStart = getClinicDayStartIso(today);
  const dayEnd = getClinicDayEndIso(today);
  const supabase = createAdminClient();
  const isDoctor = viewer.role === "doctor";

  const [roomMap, avgServiceTime, graceMinutes, rowsResult] = await Promise.all([
    getRoomNameMap(supabase),
    getAvgServiceTime(dayStart, dayEnd, supabase),
    getNoShowGraceMinutes(),
    (async () => {
      if (!isDoctor) {
        return supabase
          .from("queue")
          .select(QUEUE_STAFF_SELECT)
          .eq("clinic_date", today)
          .order("skip_count", { ascending: true })
          .order("waiting_since", { ascending: true })
          .order("id", { ascending: true });
      }

      // Two scoped queries — never load clinic-wide tickets for doctors.
      const [byAssigned, byBookedDoctor] = await Promise.all([
        supabase
          .from("queue")
          .select(QUEUE_STAFF_SELECT)
          .eq("clinic_date", today)
          .eq("assigned_doctor_id", viewer.staffId)
          .order("skip_count", { ascending: true })
          .order("waiting_since", { ascending: true })
          .order("id", { ascending: true }),
        supabase
          .from("queue")
          .select(QUEUE_STAFF_SELECT)
          .eq("clinic_date", today)
          .eq("checkins.doctor_id", viewer.staffId)
          .order("skip_count", { ascending: true })
          .order("waiting_since", { ascending: true })
          .order("id", { ascending: true }),
      ]);

      if (byAssigned.error) return byAssigned;
      if (byBookedDoctor.error) return byBookedDoctor;

      const merged = mergeQueueRowsById(
        (byAssigned.data ?? []) as Record<string, unknown>[],
        (byBookedDoctor.data ?? []) as Record<string, unknown>[]
      );
      return { data: merged, error: null };
    })(),
  ]);

  if (rowsResult.error) {
    return {
      appointment: emptyPayload(avgServiceTime, graceMinutes),
      error: rowsResult.error,
    };
  }

  let rows = (rowsResult.data ?? []) as Record<string, unknown>[];

  // Defense in depth if a row slipped through
  if (isDoctor) {
    rows = rows.filter((row) => doctorOwnsQueueRow(viewer.staffId, row));
  }

  let waitingPosition = 0;
  let readyPosition = 0;
  const waiting: unknown[] = [];
  const withNurse: unknown[] = [];
  const readyForDoctor: unknown[] = [];
  const inProgress: unknown[] = [];
  const completed: unknown[] = [];
  const noShow: unknown[] = [];

  for (const row of rows) {
    const checkinRaw = Array.isArray(row.checkins) ? row.checkins[0] : row.checkins;
    const checkin = checkinRaw as Record<string, unknown> | null | undefined;

    const patientRaw = checkin?.patients;
    let patient = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as
      | Record<string, unknown>
      | null
      | undefined;
    if (isDoctor) {
      patient = sanitizeDoctorPatientFields(patient) as Record<string, unknown> | null;
    }

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

    const name = patient
      ? `${String(patient.first_name ?? "")} ${String(patient.last_name ?? "")}`.trim()
      : "";
    const visitType = apptType?.name ?? "";
    const reason = (checkin?.reason as string | null | undefined) ?? "";
    const assignedDoctorId = resolveAssignedDoctorId(row);
    const assignedDoctorLabel = doctor
      ? `Dr. ${doctor.first_name} ${doctor.last_name}`
      : "";

    const baseLounge = {
      id: row.queue_number,
      queueId: row.id,
      queue_number: row.queue_number,
      name,
      time: row.created_at ? format(new Date(String(row.created_at)), "hh:mm a") : "",
      priority: row.priority,
      visitType,
      reason,
      skip_count: row.skip_count ?? 0,
      assignedDoctorId,
      assignedDoctorLabel,
      bp_systolic: row.bp_systolic ?? null,
      bp_diastolic: row.bp_diastolic ?? null,
      temperature_c: row.temperature_c ?? null,
      triage_notes: row.triage_notes ?? null,
      status: row.status,
    };

    const status = String(row.status);

    if (status === "waiting") {
      waitingPosition++;
      waiting.push({
        ...baseLounge,
        position: waitingPosition,
        est_wait_minutes: waitingPosition * avgServiceTime,
      });
    } else if (status === "with_nurse") {
      withNurse.push(baseLounge);
    } else if (status === "ready_for_doctor") {
      readyPosition++;
      readyForDoctor.push({
        ...baseLounge,
        position: readyPosition,
        est_wait_minutes: readyPosition * avgServiceTime,
      });
    } else if (isCalledLikeStatus(status)) {
      inProgress.push({
        id: row.queue_number,
        queueId: row.id,
        queue_number: row.queue_number,
        name,
        time: row.called_at ? format(new Date(String(row.called_at)), "hh:mm a") : "",
        doctor: doctor ? `Dr. ${doctor.first_name} ${doctor.last_name}` : "",
        room: resolveRoomName(row.room_id as number | null, roomMap),
        status,
        called_at: row.called_at,
        present_at: row.present_at ?? null,
        assignedDoctorId,
        assignedDoctorLabel,
        skip_count: row.skip_count ?? 0,
        visitType,
        reason,
      });
    } else if (status === "no_show") {
      noShow.push({
        id: row.queue_number,
        queueId: row.id,
        queue_number: row.queue_number,
        name,
        time: row.created_at ? format(new Date(String(row.created_at)), "hh:mm a") : "",
        assignedDoctorId,
      });
    } else if (status === "completed") {
      completed.push({
        id: row.queue_number,
        queueId: row.id,
        name,
        time: row.created_at ? format(new Date(String(row.created_at)), "hh:mm a") : "",
        assignedDoctorId,
      });
    }
  }

  return {
    appointment: {
      waiting,
      withNurse,
      readyForDoctor,
      inProgress,
      completed,
      noShow,
      avg_service_time: avgServiceTime,
      no_show_grace_minutes: graceMinutes,
    },
    error: null,
  };
}

function emptyPayload(
  avgServiceTime: number,
  graceMinutes: number
): StaffQueueAppointmentPayload {
  return {
    waiting: [],
    withNurse: [],
    readyForDoctor: [],
    inProgress: [],
    completed: [],
    noShow: [],
    avg_service_time: avgServiceTime,
    no_show_grace_minutes: graceMinutes,
  };
}

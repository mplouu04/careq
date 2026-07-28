import { createAdminClient } from "@/lib/supabase/admin";
import { CHECKIN_TYPE, MAX_ADVANCE_BOOKING_DAYS } from "@/lib/constants";
import { normalizePhone, patientPhonesMatch } from "@/lib/phone";
import { getDoctorAvailableSlots } from "@/lib/slots-availability";
import { getClinicTodayYmd, getClinicDayStartIso } from "@/lib/datetime";
import { nextAppointmentReference } from "@/lib/counters";
import { logAudit } from "@/lib/audit";
import { resolveExistingPatient, resolvePatientIdFromRef } from "@/lib/services/patient.service";
import { addDays, format, parseISO } from "date-fns";
import { normalizeAppointmentReference } from "@/lib/utils";

/** Pending always shows; other active statuses only from start of clinic day onward. */
export function isActiveAppointmentForLookup(
  status: string,
  appointmentDate: string | null | undefined,
  todayStartIso: string
): boolean {
  if (status === "pending") return true;
  if (!appointmentDate) return false;
  return new Date(appointmentDate).getTime() >= new Date(todayStartIso).getTime();
}

export async function lookupPatientAppointments(phone: string, dob: string) {
  const supabase = createAdminClient();
  const phoneDigits = phone.replace(/\D/g, "");
  const last7 = phoneDigits.slice(-7);

  let patientsQuery = supabase
    .from("patients")
    .select("id, public_id, first_name, last_name, phone, phone_normalized")
    .eq("date_of_birth", dob);

  if (phoneDigits.length === 11) {
    patientsQuery = patientsQuery.or(
      `phone_normalized.eq.${phoneDigits},phone.eq.${phoneDigits}`
    );
  } else if (last7.length === 7) {
    patientsQuery = patientsQuery.or(
      `phone_last7.eq.${last7},phone_normalized.like.%${last7},phone.like.%${last7}`
    );
  }

  const { data: patients, error: patientsError } = await patientsQuery.limit(20);

  if (patientsError) {
    console.error("[lookupPatientAppointments] patients query failed", patientsError);
    return { appointments: [], publicId: null, patientName: "" };
  }

  const matched = (patients ?? []).filter((p) => patientPhonesMatch(p, phone));

  if (!matched.length) {
    return { appointments: [], publicId: null, patientName: "" };
  }

  const ids = matched.map((p) => p.id);
  const today = getClinicTodayYmd();
  const todayStartIso = getClinicDayStartIso(today);

  const { data, error: checkinsError } = await supabase
    .from("checkins")
    .select(
      `checkin_id, reference_number, scheduled_time, appointment_date, status, reason,
       appointment_types(name),
       staff:doctor_id(first_name, last_name)`
    )
    .in("patient_id", ids)
    .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
    .not("status", "in", '("cancelled","completed","no_show")')
    .order("appointment_date", { ascending: true })
    .limit(50);

  if (checkinsError) {
    console.error("[lookupPatientAppointments] checkins query failed", checkinsError);
    return { appointments: [], publicId: null, patientName: "" };
  }

  const activeRows = (data ?? []).filter((a) =>
    isActiveAppointmentForLookup(a.status, a.appointment_date, todayStartIso)
  );

  const appointments = activeRows.slice(0, 20).map((a) => {
    const doctorRaw = a.staff as unknown;
    const doctor = (Array.isArray(doctorRaw) ? doctorRaw[0] : doctorRaw) as
      | { first_name: string; last_name: string }
      | null
      | undefined;
    const typeRaw = a.appointment_types as unknown;
    const apptType = (Array.isArray(typeRaw) ? typeRaw[0] : typeRaw) as
      | { name: string }
      | null
      | undefined;
    const apptDate = a.appointment_date ? new Date(a.appointment_date) : null;

    return {
      checkinId: a.checkin_id,
      reference: a.reference_number,
      date: apptDate ? format(apptDate, "MMMM d, yyyy") : "",
      time: a.scheduled_time ? formatTime12h(a.scheduled_time.slice(0, 5)) : "",
      doctor: doctor ? `Dr. ${doctor.first_name} ${doctor.last_name}` : "",
      type: apptType?.name ?? "",
      reason: a.reason ?? "",
      status: a.status,
    };
  });

  return {
    appointments,
    publicId: matched[0]?.public_id ?? null,
    patientName: matched[0] ? `${matched[0].first_name} ${matched[0].last_name}` : "",
  };
}

export async function lookupAppointmentByReference(reference: string, phone: string) {
  const supabase = createAdminClient();
  const ref = normalizeAppointmentReference(reference);
  const phoneInput = phone.trim();

  const { data: checkin, error } = await supabase
    .from("checkins")
    .select(
      `checkin_id, reference_number, scheduled_time, appointment_date, status, reason, patient_id,
       appointment_types(name),
       staff:doctor_id(first_name, last_name),
       patients(first_name, last_name, public_id, phone, phone_normalized)`
    )
    .eq("reference_number", ref)
    .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
    .maybeSingle();

  if (error) {
    console.error("[lookupAppointmentByReference] checkin query failed", error);
    return { appointments: [], publicId: null, patientName: "" };
  }

  if (!checkin) {
    return { appointments: [], publicId: null, patientName: "" };
  }

  const patientRaw = checkin.patients as unknown;
  const patient = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as {
    first_name: string;
    last_name: string;
    public_id: string;
    phone: string;
    phone_normalized: string | null;
  } | null;

  if (!patientPhonesMatch(patient, phoneInput)) {
    console.warn("[lookupAppointmentByReference] phone verification failed", {
      reference: ref,
      patientId: checkin.patient_id,
    });
    return { appointments: [], publicId: null, patientName: "" };
  }

  const doctorRaw = checkin.staff as unknown;
  const doctor = (Array.isArray(doctorRaw) ? doctorRaw[0] : doctorRaw) as
    | { first_name: string; last_name: string }
    | null
    | undefined;
  const typeRaw = checkin.appointment_types as unknown;
  const apptType = (Array.isArray(typeRaw) ? typeRaw[0] : typeRaw) as
    | { name: string }
    | null
    | undefined;
  const apptDate = checkin.appointment_date ? new Date(checkin.appointment_date) : null;

  return {
    appointments: [
      {
        checkinId: checkin.checkin_id,
        reference: checkin.reference_number,
        date: apptDate ? format(apptDate, "MMMM d, yyyy") : "",
        time: checkin.scheduled_time ? formatTime12h(checkin.scheduled_time.slice(0, 5)) : "",
        doctor: doctor ? `Dr. ${doctor.first_name} ${doctor.last_name}` : "",
        type: apptType?.name ?? "",
        reason: checkin.reason ?? "",
        status: checkin.status,
      },
    ],
    publicId: patient?.public_id ?? null,
    patientName: patient ? `${patient.first_name} ${patient.last_name}` : "",
  };
}

export async function cancelAppointment(
  reference: string,
  phone: string,
  audit?: { ip: string }
) {
  const supabase = createAdminClient();
  const ref = normalizeAppointmentReference(reference);
  const { data: checkin } = await supabase
    .from("checkins")
    .select("checkin_id, status, patients(phone, phone_normalized)")
    .eq("reference_number", ref)
    .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
    .maybeSingle();

  if (!checkin) {
    return { error: "Appointment not found", status: 404 as const };
  }

  const terminal = ["cancelled", "completed", "no_show"];
  if (terminal.includes(checkin.status ?? "")) {
    return { error: "This appointment cannot be cancelled.", status: 409 as const };
  }

  const patientRaw = checkin.patients as unknown;
  const patient = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as {
    phone: string;
    phone_normalized: string | null;
  };
  if (
    !patientPhonesMatch(patient, phone)
  ) {
    return { error: "Phone number does not match.", status: 403 as const };
  }

  const { data: updated, error } = await supabase
    .from("checkins")
    .update({ status: "cancelled" })
    .eq("checkin_id", checkin.checkin_id)
    .not("status", "in", '("cancelled","completed","no_show")')
    .select("checkin_id")
    .maybeSingle();

  if (error) {
    return { error: "Failed to cancel appointment", status: 500 as const };
  }

  if (!updated) {
    return { error: "This appointment cannot be cancelled.", status: 409 as const };
  }

  void logAudit({
    action: "appt_cancel_patient",
    tableName: "checkins",
    recordId: checkin.checkin_id,
    ipAddress: audit?.ip ?? null,
    newValues: { reference, status: "cancelled" },
  });

  return { success: true as const };
}

export async function bookAppointment(body: {
  preferredDoctor: string;
  appointmentType: string | number;
  appointmentDate: string;
  appointmentTime: string;
  termsAgreement: boolean | string;
  patient_id?: string | number;
  firstName?: string;
  lastName?: string;
  dob?: string;
  gender?: string;
  address?: string;
  phone?: string;
  email?: string;
  consent?: boolean | string;
  reason?: string;
}) {
  const supabase = createAdminClient();
  const doctorId = String(body.preferredDoctor);

  const { data: doctor } = await supabase
    .from("staff")
    .select("id")
    .eq("id", doctorId)
    .eq("role", "doctor")
    .eq("is_active", true)
    .maybeSingle();

  if (!doctor) {
    return { error: "Invalid or inactive doctor selected.", status: 400 as const };
  }

  const appointmentDate = body.appointmentDate;
  const today = getClinicTodayYmd();
  if (appointmentDate < today) {
    return { error: "Appointment date cannot be in the past.", status: 400 as const };
  }
  const maxDate = format(addDays(parseISO(today), MAX_ADVANCE_BOOKING_DAYS), "yyyy-MM-dd");
  if (appointmentDate > maxDate) {
    return {
      error: `Appointments can only be booked up to ${MAX_ADVANCE_BOOKING_DAYS} days in advance.`,
      status: 400 as const,
    };
  }

  const timeRaw = body.appointmentTime.trim();
  const timeParts = timeRaw.replace(/[^0-9:]/g, "").split(":");
  const timeNorm =
    timeParts.length >= 2
      ? `${timeParts[0].padStart(2, "0")}:${timeParts[1].padStart(2, "0")}`
      : timeRaw;

  const appTypeId = String(body.appointmentType);
  const { data: apptTypeRow } = await supabase
    .from("appointment_types")
    .select("duration, buffer_minutes, default_priority, max_concurrent")
    .eq("id", appTypeId)
    .maybeSingle();
  const durationMinutes = apptTypeRow?.duration ?? 30;
  const priority = apptTypeRow?.default_priority ?? "normal";
  const maxConcurrent = apptTypeRow?.max_concurrent ?? 1;

  const availableSlots = await getDoctorAvailableSlots(doctorId, appointmentDate, durationMinutes, appTypeId);
  if (!availableSlots.includes(timeNorm)) {
    return {
      error: "This time slot is no longer available. Please choose another.",
      status: 409 as const,
      code: "slot_unavailable" as const,
    };
  }

  let patientId: string;
  let patientPublicId: string;
  let patientCreated = false;
  let patientReused = false;
  let matchedBy: string | null = null;

  const patientIdRaw = String(body.patient_id ?? "").trim();

  if (patientIdRaw) {
    const resolvedId = await resolvePatientIdFromRef(patientIdRaw);
    if (resolvedId == null) {
      return { error: "Patient not found.", status: 400 as const };
    }

    const { data: pCheck } = await supabase
      .from("patients")
      .select("id, public_id")
      .eq("id", resolvedId)
      .maybeSingle();
    if (!pCheck) {
      return { error: "Patient not found.", status: 400 as const };
    }
    patientId = String(pCheck.id);
    patientPublicId = pCheck.public_id;
  } else {
    const phoneDigits = normalizePhone(body.phone ?? "");
    if (phoneDigits.length !== 11 || !/^09\d{9}$/.test(phoneDigits)) {
      return { error: "Enter an 11-digit mobile number starting with 09.", status: 400 as const };
    }

    const emailRaw = (body.email ?? "").toString().trim();
    const emailNorm = emailRaw !== "" ? emailRaw.toLowerCase() : null;

    const existing = await resolveExistingPatient({
      firstName: body.firstName!,
      lastName: body.lastName!,
      dob: body.dob!,
      phoneNorm: phoneDigits,
      emailNorm,
    });

    if (existing) {
      patientId = existing.id;
      patientPublicId = existing.public_id;
      patientReused = true;
      matchedBy = existing.matched_by;
    } else {
      const { data: newPatient, error: pErr } = await supabase
        .from("patients")
        .insert({
          first_name: body.firstName!,
          last_name: body.lastName!,
          date_of_birth: body.dob!,
          gender: body.gender!,
          address: body.address!,
          phone: phoneDigits,
          phone_normalized: phoneDigits,
          email: emailNorm,
          consent: Boolean(body.consent),
        })
        .select("id, public_id")
        .single();

      if (pErr) {
        if (pErr.code === "23505") {
          if (pErr.message.includes("uq_patients_phone_normalized")) {
            // Race condition: another concurrent request inserted a patient with the same phone.
            // Recover by fetching and reusing that existing record.
            const { data: racePatient } = await supabase
              .from("patients")
              .select("id, public_id")
              .eq("phone_normalized", phoneDigits)
              .maybeSingle();
            if (racePatient) {
              patientId = String(racePatient.id);
              patientPublicId = racePatient.public_id;
              patientReused = true;
              matchedBy = "phone";
            } else {
              return { error: "Failed to create patient record", status: 500 as const };
            }
          } else {
            return {
              error: "This email is already registered to another patient.",
              status: 409 as const,
              code: "duplicate_email",
            };
          }
        } else {
          return { error: "Failed to create patient record", status: 500 as const };
        }
      } else {
        patientId = String(newPatient!.id);
        patientPublicId = newPatient!.public_id;
        patientCreated = true;
      }
    }
  }

  const [{ count: noShowCount }, isDuplicate] = await Promise.all([
    supabase
      .from("checkins")
      .select("checkin_id", { count: "exact", head: true })
      .eq("patient_id", patientId)
      .eq("status", "no_show"),
    hasDuplicateActiveAppointment(patientId, doctorId, appointmentDate, timeNorm),
  ]);
  if (isDuplicate) {
    return {
      error: "You already have an active appointment with this doctor at this date and time.",
      status: 409 as const,
      code: "duplicate_appointment",
    };
  }

  const reason = (body.reason ?? "").toString().trim() || null;
  const consentAppt = body.termsAgreement === "on" || Boolean(body.termsAgreement);

  const checkin = await insertAppointmentCheckin({
    patientId,
    doctorId,
    appTypeId,
    appointmentDate,
    timeNorm,
    reason,
    consentAppt,
    priority,
    durationMinutes,
    maxConcurrent,
  });

  if ("checkin_id" in checkin) {
    return {
      success: true as const,
      appointmentID: checkin.reference_number,
      publicId: patientPublicId,
      patient_created: patientCreated,
      patient_reused: patientReused,
      matched_by: matchedBy,
      no_show_count: noShowCount ?? 0,
    };
  }

  return checkin;
}

type InsertAppointmentResult =
  | { checkin_id: number; reference_number: string }
  | { error: string; status: 409; code: "slot_unavailable" | "duplicate_appointment" }
  | { error: string; status: 500 };

async function insertAppointmentCheckin(params: {
  patientId: string;
  doctorId: string;
  appTypeId: string;
  appointmentDate: string;
  timeNorm: string;
  reason: string | null;
  consentAppt: boolean;
  priority: string;
  durationMinutes: number;
  maxConcurrent: number;
}): Promise<InsertAppointmentResult> {
  const supabase = createAdminClient();
  const appointmentDateIso = `${params.appointmentDate}T${params.timeNorm}:00`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await nextAppointmentReference(params.appointmentDate);
    const { data, error } = await supabase.rpc("book_appointment_slot", {
      p_patient_id: Number(params.patientId),
      p_doctor_id: params.doctorId,
      p_app_type_id: Number(params.appTypeId),
      p_appointment_date: appointmentDateIso,
      p_scheduled_time: params.timeNorm,
      p_duration_minutes: params.durationMinutes,
      p_max_concurrent: params.maxConcurrent,
      p_reference_number: ref,
      p_reason: params.reason,
      p_consent: params.consentAppt,
      p_priority: params.priority,
    });

    if (!error && data) {
      const row = Array.isArray(data) ? data[0] : data;
      if (row?.out_checkin_id != null) {
        return {
          checkin_id: row.out_checkin_id as number,
          reference_number: (row.out_reference_number as string) ?? ref,
        };
      }
    }

    const msg = error?.message ?? "";
    if (msg.includes("slot_unavailable")) {
      return {
        error: "This time slot is no longer available. Please choose another.",
        status: 409 as const,
        code: "slot_unavailable" as const,
      };
    }

    if (error?.code === "23505") {
      const isRefCollision =
        msg.includes("uq_checkins_reference") ||
        msg.includes("reference_number") ||
        error.details?.includes("reference_number");
      if (isRefCollision) continue;

      return {
        error: "You already have an active appointment with this doctor at this date and time.",
        status: 409 as const,
        code: "duplicate_appointment",
      };
    }

    return { error: "Failed to book appointment", status: 500 as const };
  }

  return { error: "Failed to book appointment", status: 500 as const };
}

async function hasDuplicateActiveAppointment(
  patientId: string,
  doctorId: string,
  appointmentDate: string,
  scheduledTime: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("checkins")
    .select("checkin_id")
    .eq("patient_id", patientId)
    .eq("doctor_id", doctorId)
    .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
    .gte("appointment_date", `${appointmentDate}T00:00:00`)
    .lte("appointment_date", `${appointmentDate}T23:59:59`)
    .eq("scheduled_time", scheduledTime)
    .not("status", "in", '("cancelled","no_show")')
    .maybeSingle();
  return !!data;
}

function formatTime12h(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

export async function listStaffAppointments(filter: string) {
  const supabase = createAdminClient();
  const today = getClinicTodayYmd();

  let query = supabase
    .from("checkins")
    .select(
      `checkin_id, reference_number, scheduled_time, appointment_date, status,
       patients(first_name, last_name, phone),
       staff:doctor_id(first_name, last_name),
       appointment_types(name)`
    )
    .eq("type_id", CHECKIN_TYPE.APPOINTMENT);

  if (filter === "no_show") {
    query = query.eq("status", "no_show").order("appointment_date", { ascending: false }).limit(100);
  } else if (filter === "cancelled") {
    query = query.eq("status", "cancelled").order("appointment_date", { ascending: false }).limit(100);
  } else if (filter === "all") {
    query = query.order("appointment_date", { ascending: false }).limit(200);
  } else {
    query = query
      .gte("appointment_date", `${today}T00:00:00`)
      .not("status", "in", '("cancelled","no_show","completed")')
      .order("appointment_date", { ascending: true })
      .limit(200);
  }

  const { data, error } = await query;
  return { appointments: data ?? [], error };
}

/** Allowed staff appointment status transitions (current → action → next). */
const STAFF_APPOINTMENT_TRANSITIONS: Record<
  "confirm" | "cancel" | "no_show",
  { from: string[]; to: string }
> = {
  confirm: { from: ["pending"], to: "checked_in" },
  cancel: { from: ["pending", "checked_in", "in_progress"], to: "cancelled" },
  no_show: { from: ["pending", "checked_in"], to: "no_show" },
};

export async function staffUpdateAppointment(params: {
  checkinId: number;
  status: "confirm" | "cancel" | "no_show";
  userId: string;
  ip: string;
}) {
  const transition = STAFF_APPOINTMENT_TRANSITIONS[params.status];
  if (!transition) {
    return { error: "Invalid status action", status: 400 as const };
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("checkins")
    .update({ status: transition.to })
    .eq("checkin_id", params.checkinId)
    .in("status", transition.from)
    .select("checkin_id");

  if (error) {
    return { error: "Update failed", status: 500 as const };
  }
  if (!data?.length) {
    return {
      error: "Appointment cannot be updated from its current status",
      status: 409 as const,
    };
  }

  void logAudit({
    userId: params.userId,
    action: `appt_${params.status}`,
    tableName: "checkins",
    recordId: params.checkinId,
    ipAddress: params.ip,
  });

  return { success: true as const, status: transition.to };
}

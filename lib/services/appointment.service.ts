import { createAdminClient } from "@/lib/supabase/admin";
import { CHECKIN_TYPE } from "@/lib/constants";
import { normalizePhone, phonesMatchLast7 } from "@/lib/phone";
import { getDoctorAvailableSlots } from "@/lib/slots-availability";
import { getClinicTodayYmd } from "@/lib/datetime";
import { nextAppointmentReference } from "@/lib/counters";
import { logAudit } from "@/lib/audit";
import { resolveExistingPatient } from "@/lib/services/patient.service";
import { format } from "date-fns";

export async function lookupPatientAppointments(phone: string, dob: string) {
  const supabase = createAdminClient();

  const { data: patients } = await supabase
    .from("patients")
    .select("id, first_name, last_name, phone, phone_normalized")
    .eq("date_of_birth", dob);

  const matched = (patients ?? []).filter((p) =>
    phonesMatchLast7(p.phone_normalized ?? p.phone ?? "", phone)
  );

  if (!matched.length) {
    return { appointments: [], patientId: null, patientName: "" };
  }

  const ids = matched.map((p) => p.id);
  const today = getClinicTodayYmd();

  const { data } = await supabase
    .from("checkins")
    .select(
      `checkin_id, reference_number, scheduled_time, appointment_date, status, reason,
       appointment_types(name),
       staff:doctor_id(first_name, last_name)`
    )
    .in("patient_id", ids)
    .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
    .not("status", "in", '("cancelled","completed","no_show")')
    .or(`status.eq.pending,appointment_date.gte.${today}T00:00:00`)
    .order("appointment_date", { ascending: true })
    .limit(20);

  const appointments = (data ?? []).map((a) => {
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
    patientId: matched[0]?.id ?? null,
    patientName: matched[0] ? `${matched[0].first_name} ${matched[0].last_name}` : "",
  };
}

export async function cancelAppointment(
  reference: string,
  phone: string,
  audit?: { ip: string }
) {
  const supabase = createAdminClient();
  const { data: checkin } = await supabase
    .from("checkins")
    .select("checkin_id, status, patients(phone, phone_normalized)")
    .eq("reference_number", reference)
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
  if (!phonesMatchLast7(patient?.phone_normalized ?? patient?.phone ?? "", phone)) {
    return { error: "Phone number does not match.", status: 403 as const };
  }

  await supabase
    .from("checkins")
    .update({ status: "cancelled" })
    .eq("checkin_id", checkin.checkin_id);

  await logAudit({
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
  const timeRaw = body.appointmentTime.trim();
  const timeParts = timeRaw.replace(/[^0-9:]/g, "").split(":");
  const timeNorm =
    timeParts.length >= 2
      ? `${timeParts[0].padStart(2, "0")}:${timeParts[1].padStart(2, "0")}`
      : timeRaw;

  const appTypeId = String(body.appointmentType);
  const { data: apptTypeRow } = await supabase
    .from("appointment_types")
    .select("duration")
    .eq("id", appTypeId)
    .maybeSingle();
  const durationMinutes = apptTypeRow?.duration ?? 30;

  const availableSlots = await getDoctorAvailableSlots(doctorId, appointmentDate, durationMinutes);
  if (!availableSlots.includes(timeNorm)) {
    return {
      error: "This time slot is no longer available. Please choose another.",
      status: 409 as const,
    };
  }

  let patientId: string;
  let patientCreated = false;
  let patientReused = false;
  let matchedBy: string | null = null;

  const patientIdRaw = String(body.patient_id ?? "").trim();

  if (patientIdRaw) {
    const { data: pCheck } = await supabase
      .from("patients")
      .select("id")
      .eq("id", patientIdRaw)
      .maybeSingle();
    if (!pCheck) {
      return { error: "Patient not found.", status: 400 as const };
    }
    patientId = patientIdRaw;
  } else {
    const phoneDigits = normalizePhone(body.phone ?? "");
    if (phoneDigits.length !== 11) {
      return { error: "Phone number must be exactly 11 digits.", status: 400 as const };
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
        .select("id")
        .single();

      if (pErr) {
        if (pErr.code === "23505") {
          return {
            error: "This email is already registered to another patient.",
            status: 409 as const,
            code: "duplicate_email",
          };
        }
        return { error: "Failed to create patient record", status: 500 as const };
      }
      patientId = String(newPatient!.id);
      patientCreated = true;
    }
  }

  const isDuplicate = await hasDuplicateActiveAppointment(
    patientId,
    doctorId,
    appointmentDate,
    timeNorm
  );
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
  });

  if ("error" in checkin) {
    return checkin;
  }

  return {
    success: true as const,
    appointmentID: checkin!.reference_number,
    patient_id: patientId,
    patient_created: patientCreated,
    patient_reused: patientReused,
    matched_by: matchedBy,
  };
}

async function insertAppointmentCheckin(params: {
  patientId: string;
  doctorId: string;
  appTypeId: string;
  appointmentDate: string;
  timeNorm: string;
  reason: string | null;
  consentAppt: boolean;
}) {
  const supabase = createAdminClient();

  for (let attempt = 0; attempt < 3; attempt++) {
    const ref = await nextAppointmentReference(params.appointmentDate);
    const { data, error } = await supabase
      .from("checkins")
      .insert({
        patient_id: params.patientId,
        doctor_id: params.doctorId,
        app_type_id: params.appTypeId,
        appointment_date: `${params.appointmentDate}T${params.timeNorm}:00`,
        scheduled_time: params.timeNorm,
        reason: params.reason,
        consent: params.consentAppt,
        reference_number: ref,
        type_id: CHECKIN_TYPE.APPOINTMENT,
        status: "pending",
      })
      .select("checkin_id, reference_number")
      .single();

    if (!error && data) {
      return data;
    }

    if (error?.code === "23505") {
      const isRefCollision =
        error.message?.includes("uq_checkins_reference") ||
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
      .order("appointment_date", { ascending: true });
  }

  const { data } = await query;
  return data ?? [];
}

export async function staffUpdateAppointment(params: {
  checkinId: number;
  status: "confirm" | "cancel" | "no_show";
  userId: string;
  ip: string;
}) {
  const statusMap: Record<string, string> = {
    confirm: "checked_in",
    cancel: "cancelled",
    no_show: "no_show",
  };
  const newStatus = statusMap[params.status] ?? params.status;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("checkins")
    .update({ status: newStatus })
    .eq("checkin_id", params.checkinId)
    .select("checkin_id");

  if (error || !data?.length) {
    return { error: "Update failed", status: 404 as const };
  }

  await logAudit({
    userId: params.userId,
    action: `appt_${params.status}`,
    tableName: "checkins",
    recordId: params.checkinId,
    ipAddress: params.ip,
  });

  return { success: true as const, status: newStatus };
}

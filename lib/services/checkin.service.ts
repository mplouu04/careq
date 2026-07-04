import { createAdminClient } from "@/lib/supabase/admin";
import { CHECKIN_TYPE, TIMEZONE } from "@/lib/constants";
import { patientPhonesMatch } from "@/lib/phone";
import { normalizeAppointmentReference, sanitize } from "@/lib/utils";
import { formatInTimeZone } from "date-fns-tz";
import { checkinToQueue, CheckinError, nextCounter } from "@/lib/counters";
import { consumePatientVerifyToken } from "@/lib/services/patient.service";

const TERMINAL_CHECKIN = ["cancelled", "completed", "no_show"];

function patientPhoneMatches(
  patient: { phone: string; phone_normalized: string | null } | null | undefined,
  phone: string
): boolean {
  return patientPhonesMatch(patient, phone);
}

export async function lookupAppointmentForCheckin(ref: string, phone: string) {
  const supabase = createAdminClient();
  const normalizedRef = normalizeAppointmentReference(ref);
  const { data: checkin } = await supabase
    .from("checkins")
    .select(
      `checkin_id, reference_number, scheduled_time, appointment_date, status, patient_id,
       staff:doctor_id(first_name, last_name),
       appointment_types(name),
       patients(first_name, last_name, phone, phone_normalized)`
    )
    .eq("reference_number", normalizedRef)
    .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
    .maybeSingle();

  if (!checkin) return null;

  const patientRaw = checkin.patients as unknown;
  const patient = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as {
    first_name: string;
    last_name: string;
    phone: string;
    phone_normalized: string | null;
  } | null;

  if (!patientPhoneMatches(patient, phone)) {
    return null;
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

  return [
    {
      fullname: patient ? `${patient.first_name} ${patient.last_name}` : "",
      appointment_date: checkin.appointment_date,
      doctor: doctor ? `${doctor.first_name} ${doctor.last_name}` : "",
      appointment: apptType?.name ?? "",
      time: checkin.scheduled_time,
      appnumber: checkin.reference_number,
      id: checkin.checkin_id,
    },
  ];
}

async function resolveAppointmentCheckin(appointmentId: string) {
  const supabase = createAdminClient();
  const isNumeric = /^\d+$/.test(appointmentId);

  if (!isNumeric) {
    const { data } = await supabase
      .from("checkins")
      .select(
        `checkin_id, status, patients(phone, phone_normalized)`
      )
      .eq("reference_number", appointmentId)
      .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
      .maybeSingle();
    return data;
  }

  const { data } = await supabase
    .from("checkins")
    .select(`checkin_id, status, patients(phone, phone_normalized)`)
    .eq("checkin_id", appointmentId)
    .maybeSingle();
  return data;
}

export async function checkinAppointment(appointmentId: string, phone: string) {
  const data = await resolveAppointmentCheckin(appointmentId);

  if (!data) {
    throw new CheckinError("Appointment not found", 404);
  }

  if (data.status && TERMINAL_CHECKIN.includes(data.status)) {
    throw new CheckinError(
      `Cannot check in: appointment is ${data.status.replace("_", " ")}.`,
      409
    );
  }

  const patientRaw = data.patients as unknown;
  const patient = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as
    | { phone: string; phone_normalized: string | null }
    | null
    | undefined;

  if (!patientPhoneMatches(patient, phone)) {
    throw new CheckinError("Phone number does not match.", 403);
  }

  const queueNumber = await checkinToQueue(data.checkin_id, "APPT");
  return { queueNumber };
}

export async function checkinWalkIn(body: {
  verifyToken: string;
  appointmentType: string | number;
  additionalinfo: string;
  termsAgreement: boolean | string;
}) {
  const patientId = await consumePatientVerifyToken(body.verifyToken);

  const supabase = createAdminClient();
  const counter = await nextCounter("APT_REF");
  const ref = `WALK${formatInTimeZone(new Date(), TIMEZONE, "yyyyMMdd")}${counter}`;
  const consent = body.termsAgreement === "on" || Boolean(body.termsAgreement);
  const additionalInfo = sanitize(body.additionalinfo, 500);

  const { data: checkin, error: cErr } = await supabase
    .from("checkins")
    .insert({
      patient_id: patientId,
      app_type_id: body.appointmentType,
      reason: additionalInfo,
      consent,
      reference_number: ref,
      type_id: CHECKIN_TYPE.WALK_IN,
      status: "checked_in",
    })
    .select("checkin_id")
    .single();

  if (cErr || !checkin) {
    throw new CheckinError(cErr?.message ?? "Check-in failed", 500);
  }

  const queueNumber = await checkinToQueue(checkin.checkin_id, "WALK");
  return { queueNumber, reference: ref };
}

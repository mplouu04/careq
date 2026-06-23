import { createAdminClient } from "@/lib/supabase/admin";
import { CHECKIN_TYPE, TIMEZONE } from "@/lib/constants";
import { sanitize } from "@/lib/utils";
import { formatInTimeZone } from "date-fns-tz";
import { checkinToQueue, CheckinError, nextCounter } from "@/lib/counters";
import { consumePatientVerifyToken } from "@/lib/services/patient.service";

const TERMINAL_CHECKIN = ["cancelled", "completed", "no_show"];

export async function lookupAppointmentForCheckin(ref: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("checkins")
    .select(
      `checkin_id, reference_number, scheduled_time, appointment_date, status, reason,
       patients(first_name, last_name, phone),
       staff:doctor_id(first_name, last_name),
       appointment_types(name)`
    )
    .eq("reference_number", ref)
    .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
    .maybeSingle();

  if (!data) return null;

  const patientRaw = data.patients as unknown;
  const patient = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as
    | { first_name: string; last_name: string }
    | null
    | undefined;
  const doctorRaw = data.staff as unknown;
  const doctor = (Array.isArray(doctorRaw) ? doctorRaw[0] : doctorRaw) as
    | { first_name: string; last_name: string }
    | null
    | undefined;
  const typeRaw = data.appointment_types as unknown;
  const apptType = (Array.isArray(typeRaw) ? typeRaw[0] : typeRaw) as
    | { name: string }
    | null
    | undefined;

  return [
    {
      fullname: patient ? `${patient.first_name} ${patient.last_name}` : "",
      appointment_date: data.appointment_date,
      doctor: doctor ? `${doctor.first_name} ${doctor.last_name}` : "",
      appointment: apptType?.name ?? "",
      time: data.scheduled_time,
      reason: data.reason ?? "",
      appnumber: data.reference_number,
      id: data.checkin_id,
    },
  ];
}

export async function checkinAppointment(appointmentId: string) {
  const supabase = createAdminClient();
  const isNumeric = /^\d+$/.test(appointmentId);
  let checkinId: number | null = null;

  if (!isNumeric) {
    const { data } = await supabase
      .from("checkins")
      .select("checkin_id, status")
      .eq("reference_number", appointmentId)
      .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
      .maybeSingle();
    if (data) {
      checkinId = data.checkin_id;
      if (data.status && TERMINAL_CHECKIN.includes(data.status)) {
        throw new CheckinError(
          `Cannot check in: appointment is ${data.status.replace("_", " ")}.`,
          409
        );
      }
    }
  } else {
    const { data } = await supabase
      .from("checkins")
      .select("checkin_id, status")
      .eq("checkin_id", appointmentId)
      .maybeSingle();
    if (data) {
      checkinId = data.checkin_id;
      if (data.status && TERMINAL_CHECKIN.includes(data.status)) {
        throw new CheckinError(
          `Cannot check in: appointment is ${data.status.replace("_", " ")}.`,
          409
        );
      }
    }
  }

  if (!checkinId) {
    throw new CheckinError("Appointment not found", 404);
  }

  const queueNumber = await checkinToQueue(checkinId, "APPT");
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

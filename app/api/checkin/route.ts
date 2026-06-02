import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { CHECKIN_TYPE } from "@/lib/constants";
import { format } from "date-fns";

/**
 * Queue number counter:  count all queue rows today + 1
 * Format matches legacy: APPT-{N} or WALK-{N}
 */
async function nextQueueNumber(prefix: "APPT" | "WALK"): Promise<string> {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("queue")
    .select("*", { count: "exact", head: true });
  return `${prefix}-${(count ?? 0) + 1}`;
}

/**
 * GET /api/checkin?appointmentID=<reference_number>
 * Lookup an appointment by reference number before check-in.
 * Response shape mirrors legacy api_patient_schedule.php getPatientAppointment().
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Accept both "appointmentID" (legacy) and "reference" param names
  const ref =
    searchParams.get("appointmentID") ?? searchParams.get("reference");

  if (!ref) {
    return NextResponse.json({ error: "Missing appointmentID" }, { status: 400 });
  }

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

  if (!data) {
    return NextResponse.json({ success: false, appointment: null });
  }

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

  // Return shape mirrors legacy getPatientAppointment() output
  const appointment = [
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

  return NextResponse.json({ success: true, appointment });
}

/**
 * POST /api/checkin
 *
 * Appointment check-in:  body { appointmentId: <reference_number_or_checkin_id> }
 * Walk-in check-in:      body { type: "walk-in", patientId, appointmentType, additionalinfo, termsAgreement }
 */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit("patient_checkin", ip, 10, 60))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json();
  const supabase = createAdminClient();

  // ── Appointment check-in ───────────────────────────────────────────────────
  if (body.appointmentId !== undefined) {
    const appointmentId = String(body.appointmentId);

    // Look up by reference number first, then by checkin_id as fallback
    const isNumeric = /^\d+$/.test(appointmentId);
    let checkin: { checkin_id: string } | null = null;

    if (!isNumeric) {
      // Reference number (string like APT20250704...)
      const { data } = await supabase
        .from("checkins")
        .select("checkin_id")
        .eq("reference_number", appointmentId)
        .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
        .maybeSingle();
      checkin = data;
    } else {
      // Numeric checkin_id
      const { data } = await supabase
        .from("checkins")
        .select("checkin_id")
        .eq("checkin_id", appointmentId)
        .maybeSingle();
      checkin = data;
    }

    if (!checkin) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    const queueNumber = await nextQueueNumber("APPT");
    const { error } = await supabase.from("queue").insert({
      checkin_id: checkin.checkin_id,
      queue_number: queueNumber,
      status: "waiting",
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, quenumber: queueNumber, queueNumber });
  }

  // ── Walk-in check-in ──────────────────────────────────────────────────────
  if (body.type === "walk-in") {
    const required = ["patientId", "appointmentType", "additionalinfo", "termsAgreement"];
    for (const f of required) {
      if (!body[f] && body[f] !== 0) {
        return NextResponse.json({ error: `Missing field: ${f}` }, { status: 400 });
      }
    }

    const idnumber = Date.now() % 10000;
    const ref = `WALK${format(new Date(), "yyyyMMdd")}${idnumber}`;
    const consent =
      body.termsAgreement === "on" || Boolean(body.termsAgreement) ? true : false;

    const { data: checkin, error: cErr } = await supabase
      .from("checkins")
      .insert({
        patient_id: body.patientId,
        app_type_id: body.appointmentType,
        reason: body.additionalinfo,
        consent,
        reference_number: ref,
        type_id: CHECKIN_TYPE.WALK_IN,
        status: "checked_in",
      })
      .select("checkin_id")
      .single();

    if (cErr || !checkin) {
      return NextResponse.json(
        { error: cErr?.message ?? "Check-in failed" },
        { status: 500 }
      );
    }

    const queueNumber = await nextQueueNumber("WALK");
    const { error: qErr } = await supabase.from("queue").insert({
      checkin_id: checkin.checkin_id,
      queue_number: queueNumber,
      status: "waiting",
    });

    if (qErr) {
      return NextResponse.json({ error: qErr.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, quenumber: queueNumber, queueNumber, reference: ref });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireStaff } from "@/lib/auth";
import { CHECKIN_TYPE } from "@/lib/constants";
import { normalizePhone } from "@/lib/phone";
import { format } from "date-fns";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");
  const dob = searchParams.get("dob");

  if (phone && dob) {
    const ip = getClientIp(request);
    if (!(await checkRateLimit("my_appointments", ip))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    const supabase = createAdminClient();
    const phoneNorm = normalizePhone(phone);
    const { data: patients } = await supabase
      .from("patients")
      .select("id")
      .eq("date_of_birth", dob)
      .or(`phone_normalized.eq.${phoneNorm},phone.ilike.%${phone}%`);

    if (!patients?.length) {
      return NextResponse.json({ success: true, appointments: [] });
    }

    const ids = patients.map((p) => p.id);
    const { data } = await supabase
      .from("checkins")
      .select(
        `checkin_id, reference_number, scheduled_time, appointment_date, status,
         appointment_types(name),
         staff:doctor_id(first_name, last_name)`
      )
      .in("patient_id", ids)
      .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
      .in("status", ["pending", "checked_in"])
      .order("appointment_date", { ascending: true });

    return NextResponse.json({ success: true, appointments: data ?? [] });
  }

  const auth = await requireStaff();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const { data } = await supabase
    .from("checkins")
    .select(
      `checkin_id, reference_number, scheduled_time, appointment_date, status,
       patients(first_name, last_name, phone),
       staff:doctor_id(first_name, last_name),
       appointment_types(name)`
    )
    .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
    .gte("appointment_date", `${today}T00:00:00`)
    .order("appointment_date", { ascending: true });

  return NextResponse.json({ success: true, appointments: data ?? [] });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit("book_appointment", ip))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json();

  if (body.action === "cancel") {
    const supabase = createAdminClient();
    const phoneNorm = normalizePhone(body.phone ?? "");
    const { data: checkin } = await supabase
      .from("checkins")
      .select("checkin_id, status, patients(phone, phone_normalized)")
      .eq("reference_number", body.reference)
      .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
      .maybeSingle();

    if (!checkin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const patientRaw = checkin.patients as unknown;
    const patient = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as {
      phone: string;
      phone_normalized: string | null;
    };
    const stored = patient.phone_normalized ?? normalizePhone(patient.phone);
    if (stored.slice(-7) !== phoneNorm.slice(-7)) {
      return NextResponse.json({ error: "Phone mismatch" }, { status: 403 });
    }

    await supabase
      .from("checkins")
      .update({ status: "cancelled" })
      .eq("checkin_id", checkin.checkin_id);

    return NextResponse.json({ success: true });
  }

  if (body.action === "staff_update") {
    const auth = await requireStaff();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("checkins")
      .update({ status: body.status })
      .eq("checkin_id", body.checkinId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  const {
    patientId,
    doctorId,
    appTypeId,
    date,
    time,
    reason,
  } = body;

  if (!patientId || !doctorId || !appTypeId || !date || !time) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const ref = `APPT${format(new Date(), "yyyyMMdd")}${Date.now() % 10000}`;
  const appointmentDate = `${date}T${time}:00`;

  const { data, error } = await supabase
    .from("checkins")
    .insert({
      patient_id: patientId,
      type_id: CHECKIN_TYPE.APPOINTMENT,
      doctor_id: doctorId,
      app_type_id: appTypeId,
      reference_number: ref,
      scheduled_time: time,
      appointment_date: appointmentDate,
      reason: reason ?? null,
      status: "pending",
      consent: true,
    })
    .select("checkin_id, reference_number")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, reference: data.reference_number, checkinId: data.checkin_id });
}

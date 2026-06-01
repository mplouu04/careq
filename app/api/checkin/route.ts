import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { CHECKIN_TYPE } from "@/lib/constants";
import { format } from "date-fns";

async function nextQueueNumber(prefix: string) {
  const supabase = createAdminClient();
  const { count } = await supabase
    .from("queue")
    .select("*", { count: "exact", head: true });
  return `${prefix}-${(count ?? 0) + 1}`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("reference");
  if (!ref) {
    return NextResponse.json({ error: "Missing reference" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("checkins")
    .select(
      `checkin_id, reference_number, scheduled_time, appointment_date, status,
       patients(first_name, last_name, phone),
       staff:doctor_id(first_name, last_name)`
    )
    .eq("reference_number", ref)
    .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
    .maybeSingle();

  return NextResponse.json({ success: true, appointment: data });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit("patient_checkin", ip))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json();
  const supabase = createAdminClient();

  if (body.appointmentId) {
    const { data: checkin } = await supabase
      .from("checkins")
      .select("checkin_id")
      .eq("checkin_id", body.appointmentId)
      .maybeSingle();

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
    return NextResponse.json({ success: true, queueNumber });
  }

  if (body.type === "walk-in") {
    const idnumber = Date.now() % 10000;
    const ref = `WALK${format(new Date(), "yyyyMMdd")}${idnumber}`;

    const { data: checkin, error: cErr } = await supabase
      .from("checkins")
      .insert({
        patient_id: body.patientId,
        app_type_id: body.appointmentType,
        reason: body.additionalinfo,
        consent: Boolean(body.termsAgreement),
        reference_number: ref,
        type_id: CHECKIN_TYPE.WALK_IN,
        status: "checked_in",
      })
      .select("checkin_id")
      .single();

    if (cErr || !checkin) {
      return NextResponse.json({ error: cErr?.message ?? "Check-in failed" }, { status: 500 });
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
    return NextResponse.json({ success: true, queueNumber, reference: ref });
  }

  return NextResponse.json({ error: "Invalid request" }, { status: 400 });
}

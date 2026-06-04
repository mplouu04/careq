import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { requireStaff } from "@/lib/auth";
import { CHECKIN_TYPE } from "@/lib/constants";
import { normalizePhone } from "@/lib/phone";
import { logAudit } from "@/lib/audit";
import { format } from "date-fns";
import { getDoctorAvailableSlots } from "@/lib/slots-availability";
import { getClinicTodayYmd } from "@/lib/datetime";

export const dynamic = "force-dynamic";

/**
 * Resolve existing patient — priority: phone → email → name+DOB
 */
async function resolveExistingPatient(params: {
  firstName: string;
  lastName: string;
  dob: string;
  phoneNorm: string;
  emailNorm: string | null;
}): Promise<{ id: string; matched_by: string } | null> {
  const supabase = createAdminClient();

  if (params.phoneNorm) {
    const { data } = await supabase
      .from("patients")
      .select("id")
      .eq("phone_normalized", params.phoneNorm)
      .maybeSingle();
    if (data) return { id: data.id, matched_by: "phone" };
  }

  if (params.emailNorm) {
    const { data } = await supabase
      .from("patients")
      .select("id")
      .eq("email", params.emailNorm)
      .maybeSingle();
    if (data) return { id: data.id, matched_by: "email" };
  }

  const { data } = await supabase
    .from("patients")
    .select("id")
    .ilike("first_name", params.firstName)
    .ilike("last_name", params.lastName)
    .eq("date_of_birth", params.dob)
    .maybeSingle();
  if (data) return { id: data.id, matched_by: "name_dob" };

  return null;
}

/**
 * Check for a duplicate active appointment (same patient + doctor + date + time).
 * Excludes cancelled / no_show status.
 */
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

// ─── GET ──────────────────────────────────────────────────────────────────────

/**
 * Staff list:   GET /api/appointments
 * Patient lookup: GET /api/appointments?phone=&dob=
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const phone = searchParams.get("phone");
  const dob = searchParams.get("dob");

  // Patient self-lookup (my-appointments)
  if (phone && dob) {
    const ip = getClientIp(request);
    if (!(await checkRateLimit("patient_lookup", ip, 10, 60))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const supabase = createAdminClient();
    const phoneNorm = normalizePhone(phone);

    // Find patient(s) matching phone + DOB (last-7-digits phone match)
    const { data: patients } = await supabase
      .from("patients")
      .select("id, first_name, last_name")
      .eq("date_of_birth", dob)
      .or(`phone_normalized.eq.${phoneNorm},phone.ilike.%${phone.slice(-7)}%`);

    if (!patients?.length) {
      return NextResponse.json({ success: true, appointments: [] });
    }

    const ids = patients.map((p) => p.id);
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

    const apptTypes = data?.map((a) => {
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

      const apptDate = a.appointment_date
        ? new Date(a.appointment_date)
        : null;

      return {
        checkinId: a.checkin_id,
        reference: a.reference_number,
        date: apptDate ? format(apptDate, "MMMM d, yyyy") : "",
        time: a.scheduled_time
          ? formatTime12h(a.scheduled_time.slice(0, 5))
          : "",
        doctor: doctor
          ? `Dr. ${doctor.first_name} ${doctor.last_name}`
          : "",
        type: apptType?.name ?? "",
        reason: a.reason ?? "",
        status: a.status,
      };
    });

    return NextResponse.json({
      success: true,
      appointments: apptTypes ?? [],
      patientName:
        patients[0]
          ? `${patients[0].first_name} ${patients[0].last_name}`
          : "",
    });
  }

  // Staff appointment list
  const auth = await requireStaff();
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const today = getClinicTodayYmd();
  const filter = new URL(request.url).searchParams.get("filter") ?? "upcoming";

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

  return NextResponse.json({ success: true, appointments: data ?? [] });
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  const ip = getClientIp(request);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Patient-initiated cancel ─────────────────────────────────────────────
  if (body.action === "cancel") {
    if (!(await checkRateLimit("patient_cancel", ip, 5, 60))) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    if (!body.reference || !body.phone) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data: checkin } = await supabase
      .from("checkins")
      .select("checkin_id, status, patients(phone, phone_normalized)")
      .eq("reference_number", body.reference)
      .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
      .maybeSingle();

    if (!checkin) {
      return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
    }

    // Reject already-terminal statuses
    const terminal = ["cancelled", "completed", "no_show"];
    if (terminal.includes(checkin.status ?? "")) {
      return NextResponse.json(
        { error: "This appointment cannot be cancelled." },
        { status: 409 }
      );
    }

    // Verify phone: last 7 digits must match
    const patientRaw = checkin.patients as unknown;
    const patient = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as {
      phone: string;
      phone_normalized: string | null;
    };
    const stored = normalizePhone(patient?.phone_normalized ?? patient?.phone ?? "");
    const incoming = normalizePhone(body.phone);
    if (stored.slice(-7) !== incoming.slice(-7)) {
      return NextResponse.json({ error: "Phone number does not match." }, { status: 403 });
    }

    await supabase
      .from("checkins")
      .update({ status: "cancelled" })
      .eq("checkin_id", checkin.checkin_id);

    return NextResponse.json({ success: true });
  }

  // ── Staff status update ──────────────────────────────────────────────────
  if (body.action === "staff_update") {
    const auth = await requireStaff();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const allowed = ["confirm", "cancel", "no_show"];
    if (!allowed.includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }

    // Map action to status
    const statusMap: Record<string, string> = {
      confirm: "checked_in",
      cancel: "cancelled",
      no_show: "no_show",
    };
    const newStatus = statusMap[body.status] ?? body.status;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("checkins")
      .update({ status: newStatus })
      .eq("checkin_id", body.checkinId)
      .select("checkin_id");

    if (error || !data?.length) {
      return NextResponse.json({ error: "Update failed" }, { status: 404 });
    }

    await logAudit({
      userId: auth.session.userId,
      action: `appt_${body.status}`,
      tableName: "checkins",
      recordId: body.checkinId,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true, status: newStatus });
  }

  // ── Book appointment ─────────────────────────────────────────────────────
  if (!(await checkRateLimit("patient_schedule", ip, 30, 60))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const required = [
    "preferredDoctor",
    "appointmentType",
    "appointmentDate",
    "appointmentTime",
    "termsAgreement",
  ];
  for (const f of required) {
    if (!body[f] && body[f] !== 0) {
      return NextResponse.json(
        { success: false, error: `Missing field: ${f}` },
        { status: 400 }
      );
    }
  }

  const doctorId = String(body.preferredDoctor);

  // Validate doctor is active
  const supabase = createAdminClient();
  const { data: doctor } = await supabase
    .from("staff")
    .select("id")
    .eq("id", doctorId)
    .eq("role", "doctor")
    .eq("is_active", true)
    .maybeSingle();

  if (!doctor) {
    return NextResponse.json(
      { success: false, error: "Invalid or inactive doctor selected." },
      { status: 400 }
    );
  }

  const appointmentDate = body.appointmentDate as string;
  const timeRaw = (body.appointmentTime as string).trim();
  // Normalize time to HH:MM
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

  const availableSlots = await getDoctorAvailableSlots(
    doctorId,
    appointmentDate,
    durationMinutes
  );
  if (!availableSlots.includes(timeNorm)) {
    return NextResponse.json(
      {
        success: false,
        error: "This time slot is no longer available. Please choose another.",
      },
      { status: 409 }
    );
  }

  // ── Resolve patient ──────────────────────────────────────────────────────
  let patientId: string;
  let patientCreated = false;
  let patientReused = false;
  let matchedBy: string | null = null;

  const patientIdRaw = String(body.patient_id ?? "").trim();

  if (patientIdRaw) {
    // Existing patient
    const { data: pCheck } = await supabase
      .from("patients")
      .select("id")
      .eq("id", patientIdRaw)
      .maybeSingle();
    if (!pCheck) {
      return NextResponse.json(
        { success: false, error: "Patient not found." },
        { status: 400 }
      );
    }
    patientId = patientIdRaw;
  } else {
    // Guest patient — validate required fields
    const guestRequired = [
      "firstName",
      "lastName",
      "dob",
      "gender",
      "address",
      "phone",
      "consent",
    ];
    for (const f of guestRequired) {
      if (!body[f]) {
        return NextResponse.json(
          { success: false, error: `Missing field for new booking: ${f}` },
          { status: 400 }
        );
      }
    }

    const emailRaw = (body.email ?? "").toString().trim();
    if (emailRaw !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid email address." },
        { status: 400 }
      );
    }
    const emailNorm = emailRaw !== "" ? emailRaw.toLowerCase() : null;

    const phoneDigits = normalizePhone(body.phone);
    if (phoneDigits.length !== 11) {
      return NextResponse.json(
        { success: false, error: "Phone number must be exactly 11 digits." },
        { status: 400 }
      );
    }

    const existing = await resolveExistingPatient({
      firstName: body.firstName,
      lastName: body.lastName,
      dob: body.dob,
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
          first_name: body.firstName,
          last_name: body.lastName,
          date_of_birth: body.dob,
          gender: body.gender,
          address: body.address,
          phone: phoneDigits,
          phone_normalized: phoneDigits,
          email: emailNorm,
          consent: Boolean(body.consent),
        })
        .select("id")
        .single();

      if (pErr) {
        if (pErr.code === "23505") {
          return NextResponse.json(
            {
              success: false,
              error: "This email is already registered to another patient.",
              code: "duplicate_email",
            },
            { status: 409 }
          );
        }
        return NextResponse.json(
          { success: false, error: "Failed to create patient record" },
          { status: 500 }
        );
      }
      patientId = newPatient!.id;
      patientCreated = true;
    }
  }

  // Duplicate appointment check
  const isDuplicate = await hasDuplicateActiveAppointment(
    patientId,
    doctorId,
    appointmentDate,
    timeNorm
  );
  if (isDuplicate) {
    return NextResponse.json(
      {
        success: false,
        error:
          "You already have an active appointment with this doctor at this date and time.",
        code: "duplicate_appointment",
      },
      { status: 409 }
    );
  }

  // Generate reference: APT{Ymd}{n} (matches legacy format)
  const { count: checkinCount } = await supabase
    .from("checkins")
    .select("*", { count: "exact", head: true });
  const idnumber = (checkinCount ?? 0) + 1;
  const ref = `APT${format(new Date(appointmentDate), "yyyyMMdd")}${idnumber}`;

  const reason = (body.reason ?? "").toString().trim() || null;
  const consentAppt = body.termsAgreement === "on" || Boolean(body.termsAgreement);

  const { data: checkin, error: cErr } = await supabase
    .from("checkins")
    .insert({
      patient_id: patientId,
      doctor_id: doctorId,
      app_type_id: appTypeId,
      appointment_date: `${appointmentDate}T${timeNorm}:00`,
      scheduled_time: timeNorm,
      reason,
      consent: consentAppt,
      reference_number: ref,
      type_id: CHECKIN_TYPE.APPOINTMENT,
      status: "pending",
    })
    .select("checkin_id, reference_number")
    .single();

  if (cErr) {
    if (cErr.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          error: "You already have an active appointment with this doctor at this date and time.",
          code: "duplicate_appointment",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Failed to book appointment" },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    appointmentID: checkin!.reference_number,
    patient_id: patientId,
    patient_created: patientCreated,
    patient_reused: patientReused,
    matched_by: matchedBy,
  });
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime12h(time: string): string {
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr ?? "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}

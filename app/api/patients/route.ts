import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/phone";
import { sanitize } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * Resolve an existing patient by priority:
 * 1. phone (normalized) match
 * 2. email match (if provided)
 * 3. first_name + last_name + dob match
 *
 * Returns { id, matched_by } or null.
 */
async function resolveExistingPatient(params: {
  firstName: string;
  lastName: string;
  dob: string;
  phoneNorm: string;
  emailNorm: string | null;
}): Promise<{ id: string; matched_by: string } | null> {
  const supabase = createAdminClient();

  // 1. Phone match
  if (params.phoneNorm) {
    const { data } = await supabase
      .from("patients")
      .select("id")
      .eq("phone_normalized", params.phoneNorm)
      .maybeSingle();
    if (data) return { id: data.id, matched_by: "phone" };
  }

  // 2. Email match
  if (params.emailNorm) {
    const { data } = await supabase
      .from("patients")
      .select("id")
      .eq("email", params.emailNorm)
      .maybeSingle();
    if (data) return { id: data.id, matched_by: "email" };
  }

  // 3. Name + DOB match
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

/** GET /api/patients?term=&dob= */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const { searchParams } = new URL(request.url);
  const term = searchParams.get("term")?.trim() ?? "";
  const dob = searchParams.get("dob")?.trim() ?? "";

  if (term.length < 2) {
    return NextResponse.json({ success: true, patients: [] });
  }

  if (!(await checkRateLimit("patient_search", ip, 30, 60))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const supabase = createAdminClient();
  const likeTerm = `%${term}%`;

  let query = supabase
    .from("patients")
    .select("id, first_name, last_name, date_of_birth, phone, gender, address, created_at")
    .or(`first_name.ilike.${likeTerm},last_name.ilike.${likeTerm},phone.ilike.${likeTerm}`)
    .order("last_name", { ascending: true })
    .order("id", { ascending: true })
    .limit(10);

  if (dob) {
    query = query.eq("date_of_birth", dob);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const patients = (data ?? []).map((p) => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    dob: p.date_of_birth,
    phone: p.phone,
    gender: p.gender,
    address: p.address,
    created_at: p.created_at,
  }));

  return NextResponse.json({ success: true, patients });
}

/** POST /api/patients — register a new patient or return an existing match */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit("patient_register", ip, 10, 60))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const required = ["firstName", "lastName", "dob", "gender", "phone", "address", "consent"];
  for (const f of required) {
    if (body[f] === undefined || body[f] === "") {
      return NextResponse.json({ success: false, error: `Missing field: ${f}` }, { status: 400 });
    }
  }

  // Email validation (optional field)
  const emailRaw = (body.email ?? "").toString().trim();
  if (emailRaw !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailRaw)) {
    return NextResponse.json(
      { success: false, error: "Please enter a valid email address." },
      { status: 400 }
    );
  }
  const emailNorm = emailRaw !== "" ? emailRaw.toLowerCase() : null;

  // Phone: exactly 11 digits
  const phoneDigits = normalizePhone(body.phone);
  if (phoneDigits.length !== 11) {
    return NextResponse.json(
      { success: false, error: "Phone number must be exactly 11 digits." },
      { status: 400 }
    );
  }

  // DOB: must be YYYY-MM-DD with year between 1900 and current year
  const dob = sanitize(body.dob, 10);
  const dobYear = parseInt(dob.slice(0, 4), 10);
  const currentYear = new Date().getFullYear();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dob) || dobYear < 1900 || dobYear > currentYear) {
    return NextResponse.json(
      { success: false, error: "Invalid date of birth." },
      { status: 400 }
    );
  }

  // Sanitize name/address fields
  const firstName = sanitize(body.firstName, 100);
  const lastName = sanitize(body.lastName, 100);
  const address = sanitize(body.address, 255);

  if (!firstName || !lastName) {
    return NextResponse.json(
      { success: false, error: "First and last name are required." },
      { status: 400 }
    );
  }

  // Duplicate patient detection
  const existing = await resolveExistingPatient({
    firstName,
    lastName,
    dob,
    phoneNorm: phoneDigits,
    emailNorm,
  });

  if (existing) {
    return NextResponse.json({
      success: true,
      patient: existing.id,
      reused_existing: true,
      matched_by: existing.matched_by,
      message:
        "We matched your details to an existing patient profile. No new record was created.",
    });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("patients")
    .insert({
      first_name: firstName,
      last_name: lastName,
      date_of_birth: dob,
      gender: body.gender,
      phone: phoneDigits,
      phone_normalized: phoneDigits,
      email: emailNorm,
      address,
      consent: Boolean(body.consent),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        {
          success: false,
          error: "This email is already registered to another patient.",
          code: "duplicate_email",
        },
        { status: 409 }
      );
    }
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, patient: data.id, reused_existing: false });
}

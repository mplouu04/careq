import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/phone";
import { sanitize } from "@/lib/utils";
import {
  escapePostgrestValue,
  ilikePattern,
  isDigitsOnly,
  minSearchLength,
  normalizePhoneDigits,
  splitSearchTokens,
} from "@/lib/patient-search";

export const dynamic = "force-dynamic";

type PatientRow = {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  gender: string;
  address: string;
  created_at: string;
};

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
    if (data) return { id: String(data.id), matched_by: "phone" };
  }

  if (params.emailNorm) {
    const { data } = await supabase
      .from("patients")
      .select("id")
      .eq("email", params.emailNorm)
      .maybeSingle();
    if (data) return { id: String(data.id), matched_by: "email" };
  }

  const { data } = await supabase
    .from("patients")
    .select("id")
    .ilike("first_name", params.firstName)
    .ilike("last_name", params.lastName)
    .eq("date_of_birth", params.dob)
    .maybeSingle();
  if (data) return { id: String(data.id), matched_by: "name_dob" };

  return null;
}

function mapPatient(p: PatientRow) {
  return {
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    dob: p.date_of_birth,
    phone: p.phone,
    gender: p.gender,
    address: p.address,
    created_at: p.created_at,
  };
}

async function searchPatients(term: string, dob: string): Promise<PatientRow[]> {
  const supabase = createAdminClient();
  const select =
    "id, first_name, last_name, date_of_birth, phone, gender, address, created_at";
  const seen = new Map<number, PatientRow>();

  const addRows = (rows: PatientRow[] | null) => {
    for (const r of rows ?? []) {
      if (!seen.has(r.id)) seen.set(r.id, r);
    }
  };

  const pattern = ilikePattern(term);
  const quoted = escapePostgrestValue(pattern);

  if (isDigitsOnly(term)) {
    const idNum = parseInt(term, 10);
    if (!Number.isNaN(idNum)) {
      let q = supabase.from("patients").select(select).eq("id", idNum);
      if (dob) q = q.eq("date_of_birth", dob);
      const { data } = await q;
      addRows(data as PatientRow[] | null);
    }

    const digits = normalizePhoneDigits(term);
    const phoneOr = [
      `phone.ilike."%${escapePostgrestValue(digits)}%"`,
      `phone_normalized.ilike."%${escapePostgrestValue(digits)}%"`,
    ].join(",");
    let q = supabase.from("patients").select(select).or(phoneOr).limit(10);
    if (dob) q = q.eq("date_of_birth", dob);
    const { data } = await q;
    addRows(data as PatientRow[] | null);
  } else {
    const tokens = splitSearchTokens(term);
    if (tokens.length >= 2) {
      const [a, b] = tokens;
      const pa = escapePostgrestValue(ilikePattern(a));
      const pb = escapePostgrestValue(ilikePattern(b));

      for (const filter of [
        `and(first_name.ilike."${pa}",last_name.ilike."${pb}")`,
        `and(first_name.ilike."${pb}",last_name.ilike."${pa}")`,
      ]) {
        let q = supabase.from("patients").select(select).or(filter).limit(10);
        if (dob) q = q.eq("date_of_birth", dob);
        const { data } = await q;
        addRows(data as PatientRow[] | null);
      }
    }

    const orFilter = [
      `first_name.ilike."${quoted}"`,
      `last_name.ilike."${quoted}"`,
      `phone.ilike."${quoted}"`,
      `phone_normalized.ilike."${quoted}"`,
    ].join(",");
    let q = supabase.from("patients").select(select).or(orFilter).limit(10);
    if (dob) q = q.eq("date_of_birth", dob);
    const { data } = await q;
    addRows(data as PatientRow[] | null);
  }

  return Array.from(seen.values()).sort((x, y) =>
    x.last_name.localeCompare(y.last_name)
  );
}

/** GET /api/patients?term=&dob= */
export async function GET(request: Request) {
  const ip = getClientIp(request);
  const { searchParams } = new URL(request.url);
  const term = searchParams.get("term")?.trim() ?? "";
  const dob = searchParams.get("dob")?.trim() ?? "";

  if (!minSearchLength(term)) {
    return NextResponse.json({ success: true, patients: [] });
  }

  if (!(await checkRateLimit("patient_search", ip, 30, 60))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  try {
    const rows = await searchPatients(term, dob);
    return NextResponse.json({
      success: true,
      patients: rows.map(mapPatient),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

  const dobVal = sanitize(body.dob, 10);
  const dobYear = parseInt(dobVal.slice(0, 4), 10);
  const currentYear = new Date().getFullYear();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dobVal) || dobYear < 1900 || dobYear > currentYear) {
    return NextResponse.json(
      { success: false, error: "Invalid date of birth." },
      { status: 400 }
    );
  }

  const firstName = sanitize(body.firstName, 100);
  const lastName = sanitize(body.lastName, 100);
  const address = sanitize(body.address, 255);

  if (!firstName || !lastName) {
    return NextResponse.json(
      { success: false, error: "First and last name are required." },
      { status: 400 }
    );
  }

  const existing = await resolveExistingPatient({
    firstName,
    lastName,
    dob: dobVal,
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
      date_of_birth: dobVal,
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

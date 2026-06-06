import { createAdminClient } from "@/lib/supabase/admin";
import {
  escapePostgrestValue,
  ilikePattern,
  isDigitsOnly,
  normalizePhoneDigits,
  splitSearchTokens,
} from "@/lib/patient-search";

export type PatientRow = {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
  gender: string;
  address: string;
  created_at: string;
};

export async function resolveExistingPatient(params: {
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

export async function searchPatients(term: string, dob: string): Promise<PatientRow[]> {
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

export function mapPatient(p: PatientRow) {
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

export function maskPatientName(firstName: string, lastName: string): string {
  const initial = firstName.charAt(0).toUpperCase();
  return `${initial}. ${lastName.charAt(0).toUpperCase()}***`;
}

export type RegisterPatientInput = {
  firstName: string;
  lastName: string;
  dob: string;
  gender: string;
  phone: string;
  address: string;
  consent: boolean | string;
  email?: string;
};

export async function registerPatient(body: RegisterPatientInput) {
  const supabase = createAdminClient();
  const { normalizePhone } = await import("@/lib/phone");
  const { sanitize } = await import("@/lib/utils");

  const emailNorm = body.email ? body.email.toLowerCase() : null;
  const phoneDigits = normalizePhone(body.phone);

  if (phoneDigits.length !== 11) {
    return {
      error: "Phone number must be exactly 11 digits.",
      status: 400 as const,
    };
  }

  const dobVal = sanitize(body.dob, 10);
  const dobYear = parseInt(dobVal.slice(0, 4), 10);
  const currentYear = new Date().getFullYear();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dobVal) || dobYear < 1900 || dobYear > currentYear) {
    return { error: "Invalid date of birth.", status: 400 as const };
  }

  const firstName = sanitize(body.firstName, 100);
  const lastName = sanitize(body.lastName, 100);
  const address = sanitize(body.address, 255);

  const existing = await resolveExistingPatient({
    firstName,
    lastName,
    dob: dobVal,
    phoneNorm: phoneDigits,
    emailNorm,
  });

  if (existing) {
    return {
      success: true as const,
      patient: existing.id,
      reused_existing: true,
      matched_by: existing.matched_by,
      message:
        "We matched your details to an existing patient profile. No new record was created.",
    };
  }

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
      consent: body.consent === "on" || Boolean(body.consent),
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return {
        error: "This email is already registered to another patient.",
        status: 409 as const,
        code: "duplicate_email" as const,
      };
    }
    return { error: error.message, status: 500 as const };
  }

  return {
    success: true as const,
    patient: data.id,
    reused_existing: false,
  };
}

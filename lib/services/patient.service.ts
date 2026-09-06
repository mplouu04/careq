import { createAdminClient } from "@/lib/supabase/admin";
import { CheckinError } from "@/lib/counters";
import { patientPhonesMatch } from "@/lib/phone";
import {
  escapePostgrestValue,
  ilikePattern,
  isDigitsOnly,
  normalizePhoneDigits,
  splitSearchTokens,
} from "@/lib/patient-search";

const PATIENT_PUBLIC_ID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPatientPublicId(value: string): boolean {
  return PATIENT_PUBLIC_ID_RE.test(value.trim());
}

/** Resolves a public UUID or internal integer id to the patients.id row. */
export async function resolvePatientIdFromRef(ref: string): Promise<number | null> {
  const trimmed = ref.trim();
  if (!trimmed) return null;

  const supabase = createAdminClient();
  const column = isPatientPublicId(trimmed) ? "public_id" : "id";
  const { data } = await supabase
    .from("patients")
    .select("id")
    .eq(column, trimmed)
    .maybeSingle();

  return data?.id ?? null;
}

export type PatientRow = {
  id: number;
  public_id: string;
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
}): Promise<{ id: string; public_id: string; matched_by: string } | null> {
  const supabase = createAdminClient();
  const select = "id, public_id";

  if (params.phoneNorm) {
    const { data } = await supabase
      .from("patients")
      .select(select)
      .eq("phone_normalized", params.phoneNorm)
      .maybeSingle();
    if (data) {
      return {
        id: String(data.id),
        public_id: data.public_id,
        matched_by: "phone",
      };
    }
  }

  if (params.emailNorm) {
    const { data } = await supabase
      .from("patients")
      .select(select)
      .eq("email", params.emailNorm)
      .maybeSingle();
    if (data) {
      return {
        id: String(data.id),
        public_id: data.public_id,
        matched_by: "email",
      };
    }
  }

  const { data } = await supabase
    .from("patients")
    .select(select)
    .ilike("first_name", params.firstName)
    .ilike("last_name", params.lastName)
    .eq("date_of_birth", params.dob)
    .maybeSingle();
  if (data) {
    return {
      id: String(data.id),
      public_id: data.public_id,
      matched_by: "name_dob",
    };
  }

  return null;
}

export async function searchPatients(term: string, dob: string): Promise<PatientRow[]> {
  const supabase = createAdminClient();
  const select =
    "id, public_id, first_name, last_name, date_of_birth, phone, gender, address, created_at";
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
    const digits = normalizePhoneDigits(term);
    const phoneOr = [
      `phone.ilike."%${escapePostgrestValue(digits)}%"`,
      `phone_normalized.ilike."%${escapePostgrestValue(digits)}%"`,
    ].join(",");

    const queries = [];
    if (!Number.isNaN(idNum)) {
      let q = supabase.from("patients").select(select).eq("id", idNum);
      if (dob) q = q.eq("date_of_birth", dob);
      queries.push(q);
    }
    let phoneQ = supabase.from("patients").select(select).or(phoneOr).limit(10);
    if (dob) phoneQ = phoneQ.eq("date_of_birth", dob);
    queries.push(phoneQ);

    const results = await Promise.all(queries);
    for (const { data } of results) {
      addRows(data as PatientRow[] | null);
    }
  } else {
    const tokens = splitSearchTokens(term);
    const queries = [];

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
        queries.push(q);
      }
    }

    const orFilter = [
      `first_name.ilike."${quoted}"`,
      `last_name.ilike."${quoted}"`,
      `phone.ilike."${quoted}"`,
      `phone_normalized.ilike."${quoted}"`,
    ].join(",");
    let broadQ = supabase.from("patients").select(select).or(orFilter).limit(10);
    if (dob) broadQ = broadQ.eq("date_of_birth", dob);
    queries.push(broadQ);

    const results = await Promise.all(queries);
    for (const { data } of results) {
      addRows(data as PatientRow[] | null);
    }
  }

  return Array.from(seen.values()).sort((x, y) =>
    x.last_name.localeCompare(y.last_name)
  );
}

export function mapPatient(p: PatientRow) {
  return {
    id: p.id,
    public_id: p.public_id,
    first_name: p.first_name,
    last_name: p.last_name,
    dob: p.date_of_birth,
    phone: p.phone,
    gender: p.gender,
    address: p.address,
    created_at: p.created_at,
  };
}

/** Public-safe patient fields — no phone, DOB, gender, or address. */
export type PatientVerifyResult =
  | { matched: true; firstName: string; verifyToken: string }
  | { matched: false };

async function createPatientSession(
  patientId: number,
  ip?: string | null
): Promise<string> {
  const supabase = createAdminClient();
  const { data: session, error } = await supabase
    .from("patient_sessions")
    .insert({
      patient_id: patientId,
      ...(ip ? { ip } : {}),
    })
    .select("token")
    .single();

  if (error || !session) {
    throw new Error(error?.message ?? "Failed to create verification session");
  }

  return session.token as string;
}

/** Validates a walk-in verify token without consuming it. */
export async function validatePatientVerifyToken(
  verifyToken: string
): Promise<number> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: session, error } = await supabase
    .from("patient_sessions")
    .select("patient_id")
    .eq("token", verifyToken)
    .eq("used", false)
    .gt("expires_at", now)
    .maybeSingle();

  if (error) {
    throw new CheckinError(error.message, 500);
  }

  if (!session) {
    throw new CheckinError("Invalid or expired verification token", 403);
  }

  return session.patient_id as number;
}

/** Validates a walk-in verify token and marks it used (single-use). */
export async function consumePatientVerifyToken(
  verifyToken: string
): Promise<number> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data: session, error } = await supabase
    .from("patient_sessions")
    .update({ used: true })
    .eq("token", verifyToken)
    .eq("used", false)
    .gt("expires_at", now)
    .select("patient_id")
    .maybeSingle();

  if (error) {
    throw new CheckinError(error.message, 500);
  }

  if (!session) {
    throw new CheckinError("Invalid or expired verification token", 403);
  }

  return session.patient_id as number;
}

export async function verifyPatientByDobAndPhone(
  dob: string,
  phoneLast7: string,
  ip?: string | null
): Promise<PatientVerifyResult> {
  const supabase = createAdminClient();
  const last7 = phoneLast7.replace(/\D/g, "").slice(-7);

  let query = supabase
    .from("patients")
    .select("id, first_name, phone, phone_normalized")
    .eq("date_of_birth", dob);

  // Prefer indexed phone_last7; fall back to wildcard for pre-migration DBs
  if (last7.length === 7) {
    query = query.or(
      `phone_last7.eq.${last7},phone_normalized.like.%${last7},phone.like.%${last7}`
    );
  }

  const { data: patients, error } = await query.limit(20);

  if (error) {
    throw new Error(error.message);
  }

  const matched = (patients ?? []).filter((p) => patientPhonesMatch(p, phoneLast7));

  if (!matched.length) {
    console.warn("[verifyPatientByDobAndPhone] verification failed", {
      candidateCount: patients?.length ?? 0,
    });
    return { matched: false };
  }

  const patient = matched[0];
  const verifyToken = await createPatientSession(patient.id, ip);

  return {
    matched: true,
    firstName: patient.first_name,
    verifyToken,
  };
}

export function mapPublicVerification(
  p: PatientRow,
  verifyToken?: string
) {
  return {
    publicId: p.public_id,
    first_name: p.first_name,
    last_name: p.last_name,
    firstName: p.first_name,
    ...(verifyToken !== undefined ? { verifyToken } : {}),
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

  if (phoneDigits.length !== 11 || !/^09\d{9}$/.test(phoneDigits)) {
    return {
      error: "Enter an 11-digit mobile number starting with 09.",
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
    if (existing.matched_by === "phone") {
      return {
        error:
          "This phone number is already registered to another patient. Please use a different number or ask staff to update the existing record.",
        status: 409 as const,
        code: "duplicate_phone" as const,
      };
    }
    const verifyToken = await createPatientSession(Number(existing.id));
    return {
      success: true as const,
      patient: existing.public_id,
      reused_existing: true,
      matched_by: existing.matched_by,
      verifyToken,
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
    .select("id, public_id")
    .single();

  if (error) {
    if (error.code === "23505") {
      if (error.message.includes("uq_patients_phone_normalized")) {
        return {
          error: "This phone number is already registered to another patient.",
          status: 409 as const,
          code: "duplicate_phone" as const,
        };
      }
      return {
        error: "This email is already registered to another patient.",
        status: 409 as const,
        code: "duplicate_email" as const,
      };
    }
    return { error: error.message, status: 500 as const };
  }

  const verifyToken = await createPatientSession(data.id);

  return {
    success: true as const,
    patient: data.public_id,
    reused_existing: false,
    verifyToken,
  };
}

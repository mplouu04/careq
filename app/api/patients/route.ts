import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { normalizePhone } from "@/lib/phone";

export async function GET(request: Request) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit("patient_search", ip))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ error: "Query too short" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const phoneNorm = normalizePhone(q);

  const { data, error } = await supabase
    .from("patients")
    .select("id, first_name, last_name, date_of_birth, phone, email")
    .or(
      `first_name.ilike.%${q}%,last_name.ilike.%${q}%,phone.ilike.%${q}%,phone_normalized.eq.${phoneNorm}`
    )
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, patients: data ?? [] });
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  if (!(await checkRateLimit("patient_register", ip))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await request.json();
  const required = [
    "firstName",
    "lastName",
    "dateOfBirth",
    "gender",
    "phone",
    "address",
    "consent",
  ];
  for (const f of required) {
    if (body[f] === undefined || body[f] === "") {
      return NextResponse.json({ error: `Missing field: ${f}` }, { status: 400 });
    }
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("patients")
    .insert({
      first_name: body.firstName,
      last_name: body.lastName,
      date_of_birth: body.dateOfBirth,
      gender: body.gender,
      phone: body.phone,
      phone_normalized: normalizePhone(body.phone),
      email: body.email || null,
      address: body.address,
      consent: Boolean(body.consent),
      is_registered: true,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, patientId: data.id });
}

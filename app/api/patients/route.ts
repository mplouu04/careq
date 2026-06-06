import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/api/with-auth";
import { parseJsonBody } from "@/lib/api/parse-body";
import { minSearchLength } from "@/lib/patient-search";
import { RegisterPatientSchema } from "@/lib/schemas/patient";
import { mapPatient, registerPatient, searchPatients } from "@/lib/services/patient.service";

export const dynamic = "force-dynamic";

/** GET /api/patients?term=&dob= */
export const GET = withRateLimit(
  "patient_search",
  async (request: Request) => {
    const { searchParams } = new URL(request.url);
    const term = searchParams.get("term")?.trim() ?? "";
    const dob = searchParams.get("dob")?.trim() ?? "";

    if (!minSearchLength(term)) {
      return NextResponse.json({ success: true, patients: [] });
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
  },
  { max: 20, windowSeconds: 60, failClosed: true }
);

/** POST /api/patients — register a new patient or return an existing match */
export const POST = withRateLimit(
  "patient_register",
  async (request: Request) => {
    const parsed = await parseJsonBody(request, RegisterPatientSchema);
    if ("error" in parsed) {
      const body = (await parsed.error.json()) as { error?: string };
      return NextResponse.json(
        { success: false, error: body.error ?? "Invalid input" },
        { status: 400 }
      );
    }

    const body = parsed.data;
    const result = await registerPatient({
      firstName: body.firstName,
      lastName: body.lastName,
      dob: body.dob,
      gender: body.gender,
      phone: body.phone,
      address: body.address,
      consent: body.consent,
      email: body.email || undefined,
    });

    if ("error" in result && !("success" in result)) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          ...(result.code ? { code: result.code } : {}),
        },
        { status: result.status }
      );
    }

    return NextResponse.json(result);
  },
  { max: 10, windowSeconds: 60, failClosed: true }
);

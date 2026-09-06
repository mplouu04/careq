import { NextResponse } from "next/server";
import { withRateLimit, withStaffAuth } from "@/lib/api/with-auth";
import { parseJsonBody } from "@/lib/api/parse-body";
import { minSearchLength } from "@/lib/patient-search";
import { PatientSearchSchema, RegisterPatientSchema } from "@/lib/schemas/patient";
import {
  mapPatient,
  registerPatient,
  searchPatients,
} from "@/lib/services/patient.service";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

/** GET /api/patients?term=&dob= — staff-only free-text search */
export const GET = withStaffAuth(
  withRateLimit(
    "patient_search",
    async (request: Request) => {
      const { searchParams } = new URL(request.url);

      const parsed = PatientSearchSchema.safeParse({
        term: searchParams.get("term") ?? "",
        dob: searchParams.get("dob") ?? undefined,
      });

      if (!parsed.success) {
        return NextResponse.json({ success: true, patients: [] });
      }

      const { term, dob = "" } = parsed.data;

      if (!minSearchLength(term)) {
        return NextResponse.json({ success: true, patients: [] });
      }

      const session = (request as Request & { staffSession?: { userId: string } }).staffSession;
      const ip = getClientIp(request);

      try {
        const rows = await searchPatients(term, dob);

        void logAudit({
          userId: session?.userId ?? null,
          action: "patient_search",
          tableName: "patients",
          newValues: { term_length: term.length, result_count: rows.length },
          ipAddress: ip,
        });

        return NextResponse.json({
          success: true,
          patients: rows.map(mapPatient),
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : "Search failed";
        return NextResponse.json({ error: message }, { status: 500 });
      }
    },
    { max: 30, windowSeconds: 60, failClosed: true }
  )
);

/** POST /api/patients — register a new patient or return an existing match */
export const POST = withRateLimit(
  "patient_register",
  async (request: Request) => {
    const ip = getClientIp(request);
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
      email: body.email,
      emailProofToken: body.emailProofToken,
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

    void logAudit({
      userId: null,
      action: "patient_register",
      tableName: "patients",
      recordId: "patient" in result ? result.patient : null,
      newValues: {
        reused_existing: "reused_existing" in result ? result.reused_existing : false,
        matched_by: "matched_by" in result ? result.matched_by : null,
      },
      ipAddress: ip,
    });

    return NextResponse.json(result);
  },
  { max: 10, windowSeconds: 60, failClosed: true }
);

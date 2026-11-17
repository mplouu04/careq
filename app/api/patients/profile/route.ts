import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api/parse-body";
import { withRateLimit } from "@/lib/api/with-auth";
import {
  PatientProfileLookupSchema,
  PatientProfilePatchSchema,
} from "@/lib/schemas/patient";
import {
  patchPatientProfile,
  resolvePatientIdsByPhoneDob,
} from "@/lib/services/patient.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.union([PatientProfileLookupSchema, PatientProfilePatchSchema]);

export const POST = withRateLimit(
  "patient_profile",
  async (request: Request) => {
    const parsed = await parseJsonBody(request, BodySchema);
    if ("error" in parsed) return parsed.error;

    const body = parsed.data;
    if (body.action === "lookup") {
      const { profile } = await resolvePatientIdsByPhoneDob(body.phone, body.dob);
      if (!profile) {
        return NextResponse.json({ success: true, profile: null });
      }
      return NextResponse.json({ success: true, profile });
    }

    const result = await patchPatientProfile({
      phone: body.phone,
      dob: body.dob,
      email: body.email,
      address: body.address,
    });
    if (!("success" in result)) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, profile: result.profile });
  },
  { max: 20, windowSeconds: 60, failClosed: true }
);
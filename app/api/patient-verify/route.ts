import { NextResponse } from "next/server";

import { logAudit } from "@/lib/audit";
import { parseJsonBody } from "@/lib/api/parse-body";
import { withPatientVerifyRateLimit } from "@/lib/api/with-auth";
import {
  clearVerificationFailures,
  getClientIp,
  recordVerificationFailure,
} from "@/lib/rate-limit";
import { PatientVerifySchema } from "@/lib/schemas/patient";
import { verifyPatientByDobAndPhone } from "@/lib/services/patient.service";

export const dynamic = "force-dynamic";

const NO_MATCH_MIN_DELAY_MS = 200;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** POST /api/patient-verify — DOB + last-7 phone identity check for public kiosk */
export const POST = withPatientVerifyRateLimit(async (request: Request) => {
    const parsed = await parseJsonBody(request, PatientVerifySchema);
    if ("error" in parsed) {
      return parsed.error;
    }

    const start = Date.now();
    const ip = getClientIp(request);

    try {
      const result = await verifyPatientByDobAndPhone(
        parsed.data.dob,
        parsed.data.phoneLast7,
        ip !== "unknown" ? ip : null
      );

      if (!result.matched) {
        if (ip !== "unknown") {
          await recordVerificationFailure(ip);
        }
        void logAudit({
          userId: null,
          action: "patient_verify_failed",
          tableName: "patients",
          ipAddress: ip !== "unknown" ? ip : null,
          newValues: { outcome: "no_match" },
        });
        const elapsed = Date.now() - start;
        const remaining = Math.max(0, NO_MATCH_MIN_DELAY_MS - elapsed);
        if (remaining > 0) {
          await sleep(remaining);
        }
        return NextResponse.json({ matched: false });
      }

      if (ip !== "unknown") {
        await clearVerificationFailures(ip);
      }

      void logAudit({
        userId: null,
        action: "patient_verify_success",
        tableName: "patients",
        ipAddress: ip !== "unknown" ? ip : null,
        newValues: { outcome: "matched" },
      });

      return NextResponse.json({
        matched: true,
        firstName: result.firstName,
        verifyToken: result.verifyToken,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Verification failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
});

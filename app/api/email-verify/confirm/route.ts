import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api/parse-body";
import { withRateLimit } from "@/lib/api/with-auth";
import { PatientEmailSchema } from "@/lib/schemas/patient";
import { confirmEmailVerification } from "@/lib/services/email-verify.service";

export const dynamic = "force-dynamic";

const ConfirmSchema = z.object({
  email: PatientEmailSchema,
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

/** POST /api/email-verify/confirm — verify code, return emailProofToken */
export const POST = withRateLimit(
  "email_verify_confirm",
  async (request: Request) => {
    const parsed = await parseJsonBody(request, ConfirmSchema, {
      genericValidationError: "Invalid input",
    });
    if ("error" in parsed) return parsed.error;

    const result = await confirmEmailVerification(
      String(parsed.data.email),
      parsed.data.code
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({
      success: true,
      emailProofToken: result.emailProofToken,
    });
  },
  { max: 10, windowSeconds: 60, failClosed: true }
);

import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody } from "@/lib/api/parse-body";
import { withRateLimit } from "@/lib/api/with-auth";
import { getClientIp } from "@/lib/rate-limit";
import { PatientEmailSchema } from "@/lib/schemas/patient";
import { sendEmailVerification } from "@/lib/services/email-verify.service";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const SendSchema = z.object({
  email: PatientEmailSchema,
});

/** POST /api/email-verify/send — send 6-digit code to email */
export const POST = withRateLimit(
  "email_verify_send",
  async (request: Request) => {
    const parsed = await parseJsonBody(request, SendSchema, {
      genericValidationError: "Enter a valid email address",
    });
    if ("error" in parsed) return parsed.error;

    const email = String(parsed.data.email).trim().toLowerCase();
    const ip = getClientIp(request);

    // Extra per-email throttle (3 / 10 minutes)
    const emailAllowed = await checkRateLimit(
      `email_verify_send_addr:${email}`,
      ip,
      3,
      600,
      true
    );
    if (!emailAllowed) {
      return NextResponse.json(
        { error: "Too many verification emails. Please wait and try again." },
        { status: 429, headers: { "Retry-After": "600" } }
      );
    }

    const result = await sendEmailVerification(email, ip !== "unknown" ? ip : null);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  },
  { max: 5, windowSeconds: 60, failClosed: true }
);

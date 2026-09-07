import { NextResponse } from "next/server";
import { sanitize, isValidRef } from "@/lib/utils";
import { withRateLimit } from "@/lib/api/with-auth";
import {
  checkinAppointment,
  checkinWalkIn,
  lookupAppointmentForCheckin,
} from "@/lib/services/checkin.service";
import { CheckinError } from "@/lib/counters";
import { CheckinBodySchema } from "@/lib/schemas/checkin";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const CheckinLookupSchema = z.object({
  action: z.literal("lookup"),
  appointmentID: z.string().min(1).optional(),
  reference: z.string().min(1).optional(),
  phone: z.string().min(1),
});

async function runCheckinLookup(refRaw: string, phoneRaw: string, request: Request) {
  const ref = sanitize(refRaw, 50);
  const phone = sanitize(phoneRaw, 20);

  if (!ref) {
    return NextResponse.json({ error: "Missing appointmentID" }, { status: 400 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Missing phone" }, { status: 400 });
  }
  if (!isValidRef(ref)) {
    return NextResponse.json({ error: "Invalid reference format" }, { status: 400 });
  }

  const appointment = await lookupAppointmentForCheckin(ref, phone);
  if (!appointment) {
    return NextResponse.json({ success: false, appointment: null });
  }

  void logAudit({
    userId: null,
    action: "checkin_lookup",
    tableName: "checkins",
    recordId: ref,
    ipAddress: getClientIp(request),
    newValues: { outcome: "found" },
  });

  return NextResponse.json({ success: true, appointment });
}

/** POST /api/checkin — lookup (body), appointment check-in, or walk-in */
export const POST = withRateLimit(
  "patient_checkin",
  async (request: Request) => {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const lookupParsed = CheckinLookupSchema.safeParse(raw);
    if (lookupParsed.success) {
      const ref =
        lookupParsed.data.appointmentID ?? lookupParsed.data.reference ?? "";
      return runCheckinLookup(ref, lookupParsed.data.phone, request);
    }

    const parsed = CheckinBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    try {
      if ("appointmentId" in parsed.data) {
        const result = await checkinAppointment(
          String(parsed.data.appointmentId),
          parsed.data.phone
        );

        void logAudit({
          userId: null,
          action: "patient_appointment_checkin",
          tableName: "checkins",
          recordId: String(parsed.data.appointmentId),
          newValues: { queueNumber: result.queueNumber },
          ipAddress: getClientIp(request),
        });

        return NextResponse.json({
          success: true,
          quenumber: result.queueNumber,
          queueNumber: result.queueNumber,
        });
      }

      const result = await checkinWalkIn(parsed.data);

      void logAudit({
        userId: null,
        action: "patient_walkin_checkin",
        tableName: "checkins",
        recordId: result.reference,
        newValues: { queueNumber: result.queueNumber },
        ipAddress: getClientIp(request),
      });

      return NextResponse.json({
        success: true,
        quenumber: result.queueNumber,
        queueNumber: result.queueNumber,
        reference: result.reference,
      });
    } catch (err) {
      if (err instanceof CheckinError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      const message = err instanceof Error ? err.message : "Check-in failed";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  },
  { max: 10, windowSeconds: 60, failClosed: true }
);

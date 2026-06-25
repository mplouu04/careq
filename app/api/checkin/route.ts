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



export const dynamic = "force-dynamic";



/** GET /api/checkin?appointmentID=<reference_number> */

export const GET = withRateLimit(
  "checkin_lookup",
  async (request: Request) => {
    const { searchParams } = new URL(request.url);

    const ref = sanitize(

      searchParams.get("appointmentID") ?? searchParams.get("reference"),

      50

    );



    if (!ref) {

      return NextResponse.json({ error: "Missing appointmentID" }, { status: 400 });

    }



    if (!isValidRef(ref)) {

      return NextResponse.json({ error: "Invalid reference format" }, { status: 400 });

    }



    const appointment = await lookupAppointmentForCheckin(ref);

    if (!appointment) {

      return NextResponse.json({ success: false, appointment: null });

    }



    return NextResponse.json({ success: true, appointment });
  },
  { max: 10, windowSeconds: 60, failClosed: true }
);



/** POST /api/checkin */

export const POST = withRateLimit(

  "patient_checkin",

  async (request: Request) => {

    let raw: unknown;

    try {

      raw = await request.json();

    } catch {

      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

    }



    const parsed = CheckinBodySchema.safeParse(raw);

    if (!parsed.success) {

      return NextResponse.json({ error: "Invalid request" }, { status: 400 });

    }



    try {

      if ("appointmentId" in parsed.data) {

        const result = await checkinAppointment(String(parsed.data.appointmentId));

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



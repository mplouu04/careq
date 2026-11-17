import { NextResponse } from "next/server";
import { parseJsonBody } from "@/lib/api/parse-body";
import { withRateLimit } from "@/lib/api/with-auth";
import {
  PatientNotificationReadSchema,
  PatientNotificationsLookupSchema,
} from "@/lib/schemas/patient";
import { resolvePatientIdsByPhoneDob } from "@/lib/services/patient.service";
import { listForPatientIds, markRead } from "@/lib/services/notification.service";
import { z } from "zod";

export const dynamic = "force-dynamic";

const BodySchema = z.union([
  PatientNotificationsLookupSchema,
  PatientNotificationReadSchema,
]);

export const POST = withRateLimit(
  "patient_notifications",
  async (request: Request) => {
    const parsed = await parseJsonBody(request, BodySchema);
    if ("error" in parsed) return parsed.error;

    const body = parsed.data;
    const { ids } = await resolvePatientIdsByPhoneDob(body.phone, body.dob);
    if (!ids.length) {
      return NextResponse.json({ success: true, notifications: [] });
    }

    if (body.action === "mark_read") {
      const result = await markRead(body.notificationId, ids);
      if (!("success" in result)) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true });
    }

    const notifications = await listForPatientIds(ids);
    return NextResponse.json({ success: true, notifications });
  },
  { max: 30, windowSeconds: 60, failClosed: true }
);
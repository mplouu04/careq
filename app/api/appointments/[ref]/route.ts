import { NextResponse } from "next/server";
import { withRateLimit } from "@/lib/api/with-auth";
import { parseJsonBody } from "@/lib/api/parse-body";
import { CancelAppointmentByRefSchema } from "@/lib/schemas/appointment";
import { getClientIp } from "@/lib/rate-limit";
import { cancelAppointment } from "@/lib/services/appointment.service";

export const dynamic = "force-dynamic";

/** DELETE /api/appointments/[ref] — patient cancel by reference + phone */
export async function DELETE(
  request: Request,
  context: { params: { ref: string } }
) {
  return withRateLimit(
    "patient_cancel",
    async (req: Request) => {
      const reference = decodeURIComponent(context.params.ref);
      if (!reference) {
        return NextResponse.json({ error: "Missing reference" }, { status: 400 });
      }

      const parsed = await parseJsonBody(req, CancelAppointmentByRefSchema);
      if ("error" in parsed) return parsed.error;

      const result = await cancelAppointment(reference, parsed.data.phone, {
        ip: getClientIp(req),
      });
      if (!("success" in result)) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true });
    },
    { max: 5, windowSeconds: 60, failClosed: true }
  )(request);
}

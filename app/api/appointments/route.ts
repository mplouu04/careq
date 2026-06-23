import { NextResponse } from "next/server";
import { getClientIp } from "@/lib/rate-limit";
import { withRateLimit, withStaffAuth } from "@/lib/api/with-auth";
import {
  BookAppointmentSchema,
  CancelAppointmentSchema,
  StaffUpdateAppointmentSchema,
} from "@/lib/schemas/appointment";
import {
  bookAppointment,
  cancelAppointment,
  listStaffAppointments,
  lookupAppointmentByReference,
  lookupPatientAppointments,
  staffUpdateAppointment,
} from "@/lib/services/appointment.service";
import { isValidRef, sanitize } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** GET /api/appointments — staff list or patient self-lookup (?phone=&dob= or ?reference=) */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const reference = searchParams.get("reference");
  const phone = searchParams.get("phone");
  const dob = searchParams.get("dob");

  if (reference) {
    return withRateLimit(
      "patient_lookup",
      async () => {
        const ref = sanitize(reference, 30);
        if (!isValidRef(ref)) {
          return NextResponse.json({ error: "Invalid reference format" }, { status: 400 });
        }
        const result = await lookupAppointmentByReference(ref);
        return NextResponse.json({
          success: true,
          appointments: result.appointments,
          publicId: result.publicId,
          patientName: result.patientName,
        });
      },
      { max: 10, windowSeconds: 60, failClosed: true }
    )(request);
  }

  if (phone && dob) {
    return withRateLimit(
      "patient_lookup",
      async () => {
        const result = await lookupPatientAppointments(phone, dob);
        return NextResponse.json({
          success: true,
          appointments: result.appointments,
          publicId: result.publicId,
          patientName: result.patientName,
        });
      },
      { max: 10, windowSeconds: 60, failClosed: true }
    )(request);
  }

  return staffListHandler(request);
}

const staffListHandler = withStaffAuth(async (request: Request) => {
  const filter = new URL(request.url).searchParams.get("filter") ?? "upcoming";
  const appointments = await listStaffAppointments(filter);
  return NextResponse.json({ success: true, appointments });
});

/** POST /api/appointments — book, cancel, or staff status update (legacy) */
export async function POST(request: Request) {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cancelParsed = CancelAppointmentSchema.safeParse(raw);
  if (cancelParsed.success) {
    return withRateLimit(
      "patient_cancel",
      async (req) => {
        const { reference, phone } = cancelParsed.data;
        const result = await cancelAppointment(reference, phone, {
          ip: getClientIp(req),
        });
        if ("error" in result && !("success" in result)) {
          return NextResponse.json({ error: result.error }, { status: result.status });
        }
        return NextResponse.json({ success: true });
      },
      { max: 5, windowSeconds: 60, failClosed: true }
    )(request);
  }

  const staffParsed = StaffUpdateAppointmentSchema.safeParse(raw);
  if (staffParsed.success) {
    return staffUpdateHandler(staffParsed.data)(request);
  }

  return withRateLimit(
    "patient_schedule",
    async () => {
      const parsed = BookAppointmentSchema.safeParse(raw);
      if (!parsed.success) {
        const message = parsed.error.issues[0]?.message ?? "Invalid input";
        return NextResponse.json({ error: message }, { status: 400 });
      }

      const result = await bookAppointment(parsed.data);
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

      return NextResponse.json({
        success: true,
        appointmentID: result.appointmentID,
        publicId: result.publicId,
        patient_created: result.patient_created,
        patient_reused: result.patient_reused,
        matched_by: result.matched_by,
      });
    },
    { max: 30, windowSeconds: 60, failClosed: true }
  )(request);
}

function staffUpdateHandler(body: {
  checkinId: number;
  status: "confirm" | "cancel" | "no_show";
}) {
  return withStaffAuth(
    async (request: Request) => {
      const staffSession = (request as Request & { staffSession?: { userId: string } }).staffSession;
      const result = await staffUpdateAppointment({
        checkinId: body.checkinId,
        status: body.status,
        userId: staffSession!.userId,
        ip: getClientIp(request),
      });

      if (!("success" in result)) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true, status: result.status });
    },
    ["admin"]
  );
}

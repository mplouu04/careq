import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withStaffAuth } from "@/lib/api/with-auth";
import { parseJsonBody } from "@/lib/api/parse-body";
import { getClientIp } from "@/lib/rate-limit";
import { logAudit } from "@/lib/audit";
import { captureException } from "@/lib/observability";
import { DoctorAdminActionSchema } from "@/lib/schemas/admin";

export const dynamic = "force-dynamic";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const DEFAULT_SCHEDULE = Array.from({ length: 7 }, (_, i) => ({
  day_of_week: i,
  day_name: DAY_NAMES[i],
  is_active: false,
  start_time: "08:00",
  end_time: "17:00",
}));

type StaffRequest = Request & {
  staffSession?: { userId: string };
};

function auditContext(request: Request) {
  const req = request as StaffRequest;
  return { userId: req.staffSession!.userId, ip: getClientIp(request) };
}

export const GET = withStaffAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId");
  const supabase = createAdminClient();

  if (doctorId) {
    const [scheduleRes, blocksRes] = await Promise.all([
      supabase
        .from("doctor_schedules")
        .select("*")
        .eq("doctor_id", doctorId)
        .order("day_of_week"),
      supabase.from("doctor_blocks").select("*").eq("doctor_id", doctorId),
    ]);

    const existing = scheduleRes.data ?? [];
    const byDay = new Map(existing.map((s) => [s.day_of_week, s]));

    const schedules = DEFAULT_SCHEDULE.map((def) => {
      const found = byDay.get(def.day_of_week);
      return found
        ? {
            id: found.id,
            day_of_week: found.day_of_week,
            day_name: DAY_NAMES[found.day_of_week],
            is_active: found.is_active,
            start_time: found.start_time?.slice(0, 5) ?? "08:00",
            end_time: found.end_time?.slice(0, 5) ?? "17:00",
          }
        : def;
    });

    return NextResponse.json({
      success: true,
      schedules,
      blocks: blocksRes.data ?? [],
    });
  }

  const { data } = await supabase
    .from("staff")
    .select("id, first_name, last_name, email")
    .eq("role", "doctor")
    .order("last_name");

  return NextResponse.json({ success: true, doctors: data ?? [] });
}, ["admin"]);

export const POST = withStaffAuth(async (request: Request) => {
  const parsed = await parseJsonBody(request, DoctorAdminActionSchema);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data;
  const supabase = createAdminClient();
  const audit = auditContext(request);

  if (body.type === "schedule") {
    if (body.action === "delete") {
      await supabase.from("doctor_schedules").delete().eq("id", body.id);
      void logAudit({
        userId: audit.userId,
        action: "doctor_schedule_delete",
        tableName: "doctor_schedules",
        recordId: body.id,
        ipAddress: audit.ip,
      });
      return NextResponse.json({ success: true });
    }

    if ("schedules" in body && body.schedules) {
      const { data: upserted, error: upsertError } = await supabase.rpc(
        "upsert_doctor_schedules",
        {
          p_doctor_id: body.doctorId,
          p_schedules: body.schedules,
        }
      );

      if (upsertError) {
        if (upsertError.message?.includes("doctor_not_found")) {
          return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
        }
        captureException(upsertError, {
          route: "/api/admin/doctors",
          action: "schedule_upsert",
          doctorId: body.doctorId,
        });
        return NextResponse.json({ error: upsertError.message }, { status: 500 });
      }

      void logAudit({
        userId: audit.userId,
        action: "doctor_schedule_upsert",
        tableName: "doctor_schedules",
        recordId: body.doctorId,
        ipAddress: audit.ip,
        newValues: { doctorId: body.doctorId, days: upserted ?? body.schedules.length },
      });
      return NextResponse.json({ success: true });
    }

    if (!("dayOfWeek" in body) || body.dayOfWeek == null || !body.startTime || !body.endTime) {
      return NextResponse.json({ error: "Invalid schedule payload" }, { status: 400 });
    }

    const { error } = await supabase.from("doctor_schedules").insert({
      doctor_id: body.doctorId,
      day_of_week: body.dayOfWeek,
      start_time: body.startTime,
      end_time: body.endTime,
      is_active: true,
    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void logAudit({
      userId: audit.userId,
      action: "doctor_schedule_add",
      tableName: "doctor_schedules",
      recordId: body.doctorId,
      ipAddress: audit.ip,
    });
    return NextResponse.json({ success: true });
  }

  if (body.type === "block") {
    if (body.action === "delete") {
      await supabase.from("doctor_blocks").delete().eq("id", body.id);
      void logAudit({
        userId: audit.userId,
        action: "doctor_block_delete",
        tableName: "doctor_blocks",
        recordId: body.id,
        ipAddress: audit.ip,
      });
      return NextResponse.json({ success: true });
    }

    const { data, error } = await supabase
      .from("doctor_blocks")
      .insert({
        doctor_id: body.doctorId,
        block_date: body.blockDate ?? null,
        day_of_week: body.dayOfWeek ?? null,
        start_time: body.startTime,
        end_time: body.endTime,
        reason: body.reason ?? "other",
        is_recurring: Boolean(body.isRecurring),
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    void logAudit({
      userId: audit.userId,
      action: "doctor_block_add",
      tableName: "doctor_blocks",
      recordId: data.id,
      ipAddress: audit.ip,
    });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}, ["admin"]);

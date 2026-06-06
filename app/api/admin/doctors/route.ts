import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

import { withStaffAuth } from "@/lib/api/with-auth";

import { getClientIp } from "@/lib/rate-limit";

import { logAudit } from "@/lib/audit";



export const dynamic = "force-dynamic";



const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];



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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;

  try {

    body = await request.json();

  } catch {

    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  }

  const supabase = createAdminClient();

  const audit = auditContext(request);



  if (body.type === "schedule") {

    if (body.action === "delete") {

      await supabase.from("doctor_schedules").delete().eq("id", body.id);

      await logAudit({

        userId: audit.userId,

        action: "doctor_schedule_delete",

        tableName: "doctor_schedules",

        recordId: body.id,

        ipAddress: audit.ip,

      });

      return NextResponse.json({ success: true });

    }



    if (Array.isArray(body.schedules) && body.doctorId) {

      const { data: doctor } = await supabase

        .from("staff")

        .select("id")

        .eq("id", body.doctorId)

        .eq("role", "doctor")

        .maybeSingle();

      if (!doctor) {

        return NextResponse.json({ error: "Doctor not found" }, { status: 404 });

      }



      for (const row of body.schedules as {

        day_of_week: number;

        is_active: boolean;

        start_time: string;

        end_time: string;

      }[]) {

        const timeRe = /^\d{2}:\d{2}$/;

        if (!timeRe.test(row.start_time) || !timeRe.test(row.end_time)) {

          return NextResponse.json(

            { error: `Invalid time format for day ${row.day_of_week}` },

            { status: 400 }

          );

        }



        const { data: existing } = await supabase

          .from("doctor_schedules")

          .select("id")

          .eq("doctor_id", body.doctorId)

          .eq("day_of_week", row.day_of_week)

          .maybeSingle();



        if (existing) {

          await supabase

            .from("doctor_schedules")

            .update({

              is_active: row.is_active,

              start_time: row.start_time,

              end_time: row.end_time,

            })

            .eq("id", existing.id);

        } else {

          await supabase.from("doctor_schedules").insert({

            doctor_id: body.doctorId,

            day_of_week: row.day_of_week,

            start_time: row.start_time,

            end_time: row.end_time,

            is_active: row.is_active,

          });

        }

      }



      await logAudit({

        userId: audit.userId,

        action: "doctor_schedule_upsert",

        tableName: "doctor_schedules",

        recordId: body.doctorId,

        ipAddress: audit.ip,

        newValues: { doctorId: body.doctorId, days: body.schedules.length },

      });

      return NextResponse.json({ success: true });

    }



    const { error } = await supabase.from("doctor_schedules").insert({

      doctor_id: body.doctorId,

      day_of_week: body.dayOfWeek,

      start_time: body.startTime,

      end_time: body.endTime,

      is_active: true,

    });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });



    await logAudit({

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

      await logAudit({

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



    await logAudit({

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


import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireStaff(["admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId");
  const supabase = createAdminClient();

  if (doctorId) {
    const [schedules, blocks] = await Promise.all([
      supabase.from("doctor_schedules").select("*").eq("doctor_id", doctorId),
      supabase.from("doctor_blocks").select("*").eq("doctor_id", doctorId),
    ]);
    return NextResponse.json({
      success: true,
      schedules: schedules.data ?? [],
      blocks: blocks.data ?? [],
    });
  }

  const { data } = await supabase
    .from("staff")
    .select("id, first_name, last_name, email")
    .eq("role", "doctor")
    .order("last_name");

  return NextResponse.json({ success: true, doctors: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireStaff(["admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const supabase = createAdminClient();

  if (body.type === "schedule") {
    if (body.action === "delete") {
      await supabase.from("doctor_schedules").delete().eq("id", body.id);
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
    return NextResponse.json({ success: true });
  }

  if (body.type === "block") {
    if (body.action === "delete") {
      await supabase.from("doctor_blocks").delete().eq("id", body.id);
      return NextResponse.json({ success: true });
    }
    const { error } = await supabase.from("doctor_blocks").insert({
      doctor_id: body.doctorId,
      block_date: body.blockDate || null,
      day_of_week: body.dayOfWeek ?? null,
      start_time: body.startTime,
      end_time: body.endTime,
      reason: body.reason ?? "other",
      is_recurring: Boolean(body.isRecurring),
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid type" }, { status: 400 });
}

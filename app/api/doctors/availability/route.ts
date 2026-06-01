import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTimeSlots, filterSameDaySlots } from "@/lib/slots";
import { getDay } from "date-fns";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId");
  const date = searchParams.get("date");
  const duration = Number(searchParams.get("duration") ?? 15);

  if (!doctorId || !date) {
    return NextResponse.json({ error: "doctorId and date required" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const dayOfWeek = getDay(new Date(date));

  const { data: schedule } = await supabase
    .from("doctor_schedules")
    .select("start_time, end_time")
    .eq("doctor_id", doctorId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .maybeSingle();

  if (!schedule) {
    return NextResponse.json({ success: true, slots: [] });
  }

  let slots = generateTimeSlots(
    schedule.start_time.slice(0, 5),
    schedule.end_time.slice(0, 5),
    duration
  );

  const { data: blocks } = await supabase
    .from("doctor_blocks")
    .select("start_time, end_time, block_date, day_of_week, is_recurring")
    .eq("doctor_id", doctorId);

  slots = slots.filter((slot) => {
    for (const block of blocks ?? []) {
      const applies =
        (block.is_recurring && block.day_of_week === dayOfWeek) ||
        (!block.is_recurring && block.block_date === date);
      if (!applies) continue;
      const bs = block.start_time.slice(0, 5);
      const be = block.end_time.slice(0, 5);
      if (slot >= bs && slot < be) return false;
    }
    return true;
  });

  const { data: booked } = await supabase
    .from("checkins")
    .select("scheduled_time")
    .eq("doctor_id", doctorId)
    .eq("type_id", 1)
    .gte("appointment_date", `${date}T00:00:00`)
    .lte("appointment_date", `${date}T23:59:59`)
    .not("status", "in", '("cancelled","no_show")');

  const bookedTimes = new Set(
    (booked ?? []).map((b) => b.scheduled_time?.slice(0, 5))
  );
  slots = slots.filter((s) => !bookedTimes.has(s));
  slots = filterSameDaySlots(slots, date);

  return NextResponse.json({ success: true, slots });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateTimeSlots, filterSameDaySlots } from "@/lib/slots";
import { getDay } from "date-fns";
import { CHECKIN_TYPE } from "@/lib/constants";

/**
 * GET /api/doctors/availability?date=YYYY-MM-DD&doctorId=
 *
 * Returns available 30-minute slots for the given doctor on the given date.
 * If doctorId is empty, returns the union of all active doctors' slots.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId")?.trim() ?? "";
  const date = searchParams.get("date");

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  if (!doctorId) {
    // Union across all active doctors
    const { data: doctors } = await supabase
      .from("staff")
      .select("id")
      .eq("role", "doctor")
      .eq("is_active", true);

    const allSlots = new Set<string>();
    for (const doc of doctors ?? []) {
      const slots = await getSlotsForDoctor(doc.id, date);
      slots.forEach((s) => allSlots.add(s));
    }
    const sorted = Array.from(allSlots).sort();
    return NextResponse.json({ success: true, available_slots: sorted });
  }

  const slots = await getSlotsForDoctor(doctorId, date);
  return NextResponse.json({ success: true, available_slots: slots, slots });
}

async function getSlotsForDoctor(doctorId: string, date: string): Promise<string[]> {
  const supabase = createAdminClient();
  const dayOfWeek = getDay(new Date(date));

  const { data: schedule } = await supabase
    .from("doctor_schedules")
    .select("start_time, end_time")
    .eq("doctor_id", doctorId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .maybeSingle();

  if (!schedule) return [];

  // Legacy always uses 30-minute slot intervals
  let slots = generateTimeSlots(
    schedule.start_time.slice(0, 5),
    schedule.end_time.slice(0, 5),
    30
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
    .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
    .gte("appointment_date", `${date}T00:00:00`)
    .lte("appointment_date", `${date}T23:59:59`)
    .not("status", "in", '("cancelled","no_show")');

  const bookedTimes = new Set(
    (booked ?? []).map((b) => b.scheduled_time?.slice(0, 5))
  );
  slots = slots.filter((s) => !bookedTimes.has(s));
  slots = filterSameDaySlots(slots, date);

  return slots;
}

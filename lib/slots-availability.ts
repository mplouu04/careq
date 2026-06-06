import { createAdminClient } from "@/lib/supabase/admin";
import { generateTimeSlots, filterSameDaySlots } from "@/lib/slots";
import { getClinicDayOfWeek } from "@/lib/datetime";
import { CHECKIN_TYPE } from "@/lib/constants";

/**
 * Available time slots for a doctor on a date (clinic timezone, configurable duration).
 */
export async function getDoctorAvailableSlots(
  doctorId: string,
  dateYmd: string,
  durationMinutes = 30
): Promise<string[]> {
  const supabase = createAdminClient();
  const dayOfWeek = getClinicDayOfWeek(dateYmd);

  const { data: schedule } = await supabase
    .from("doctor_schedules")
    .select("start_time, end_time")
    .eq("doctor_id", doctorId)
    .eq("day_of_week", dayOfWeek)
    .eq("is_active", true)
    .maybeSingle();

  if (!schedule) return [];

  let slots = generateTimeSlots(
    schedule.start_time.slice(0, 5),
    schedule.end_time.slice(0, 5),
    durationMinutes
  );

  const [{ data: blocks }, { data: booked }] = await Promise.all([
    supabase
      .from("doctor_blocks")
      .select("start_time, end_time, block_date, day_of_week, is_recurring")
      .eq("doctor_id", doctorId),
    supabase
      .from("checkins")
      .select("scheduled_time")
      .eq("doctor_id", doctorId)
      .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
      .gte("appointment_date", `${dateYmd}T00:00:00`)
      .lte("appointment_date", `${dateYmd}T23:59:59`)
      .not("status", "in", '("cancelled","no_show")'),
  ]);

  slots = slots.filter((slot) => {
    for (const block of blocks ?? []) {
      const applies =
        (block.is_recurring && block.day_of_week === dayOfWeek) ||
        (!block.is_recurring && block.block_date === dateYmd);
      if (!applies) continue;
      const bs = block.start_time.slice(0, 5);
      const be = block.end_time.slice(0, 5);
      if (slot >= bs && slot < be) return false;
    }
    return true;
  });

  const bookedTimes = new Set(
    (booked ?? []).map((b) => b.scheduled_time?.slice(0, 5))
  );
  slots = slots.filter((s) => !bookedTimes.has(s));
  slots = filterSameDaySlots(slots, dateYmd);

  return slots;
}

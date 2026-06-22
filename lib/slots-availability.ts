import { createAdminClient } from "@/lib/supabase/admin";
import { generateTimeSlots, filterSameDaySlots } from "@/lib/slots";
import { getClinicDayOfWeek } from "@/lib/datetime";
import { CHECKIN_TYPE } from "@/lib/constants";

function slotStartMinutes(time: string): number {
  const [h, m] = time.trim().slice(0, 5).split(":").map(Number);
  return h * 60 + m;
}

function slotsOverlap(
  slotStart: number,
  slotDuration: number,
  bookedStart: number,
  bookedDuration: number
): boolean {
  return (
    slotStart < bookedStart + bookedDuration &&
    slotStart + slotDuration > bookedStart
  );
}

function bookedDurationMinutes(
  appointmentTypes: { duration: number } | { duration: number }[] | null | undefined
): number {
  if (!appointmentTypes) return 30;
  if (Array.isArray(appointmentTypes)) return appointmentTypes[0]?.duration ?? 30;
  return appointmentTypes.duration ?? 30;
}

/**
 * Available time slots for a doctor on a date (clinic timezone, configurable duration).
 */
export async function getDoctorAvailableSlots(
  doctorId: string,
  dateYmd: string,
  durationMinutes = 30,
  appointmentTypeId?: string | number
): Promise<string[]> {
  const supabase = createAdminClient();
  const dayOfWeek = getClinicDayOfWeek(dateYmd);

  const apptTypeQuery =
    appointmentTypeId != null && String(appointmentTypeId).trim() !== ""
      ? supabase
          .from("appointment_types")
          .select("buffer_minutes, max_concurrent")
          .eq("id", String(appointmentTypeId))
          .maybeSingle()
      : Promise.resolve({ data: null as { buffer_minutes: number; max_concurrent: number } | null });

  const [{ data: schedule }, { data: apptType }] = await Promise.all([
    supabase
      .from("doctor_schedules")
      .select("start_time, end_time")
      .eq("doctor_id", doctorId)
      .eq("day_of_week", dayOfWeek)
      .eq("is_active", true)
      .maybeSingle(),
    apptTypeQuery,
  ]);

  if (!schedule) return [];

  const bufferMinutes = apptType?.buffer_minutes ?? 0;
  const maxConcurrent = apptType?.max_concurrent ?? 1;

  let slots = generateTimeSlots(
    schedule.start_time.slice(0, 5),
    schedule.end_time.slice(0, 5),
    durationMinutes,
    bufferMinutes
  );

  const [{ data: blocks }, { data: booked }] = await Promise.all([
    supabase
      .from("doctor_blocks")
      .select("start_time, end_time, block_date, day_of_week, is_recurring")
      .eq("doctor_id", doctorId),
    supabase
      .from("checkins")
      .select("scheduled_time, appointment_types(duration)")
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

  const bookedWindows = (booked ?? [])
    .map((b) => {
      const time = b.scheduled_time?.slice(0, 5);
      if (!time) return null;
      return {
        start: slotStartMinutes(time),
        duration: bookedDurationMinutes(
          b.appointment_types as
            | { duration: number }
            | { duration: number }[]
            | null
            | undefined
        ),
      };
    })
    .filter((w): w is { start: number; duration: number } => w != null);

  slots = slots.filter((s) => {
    const slotStart = slotStartMinutes(s);
    const overlapCount = bookedWindows.filter((b) =>
      slotsOverlap(slotStart, durationMinutes, b.start, b.duration)
    ).length;
    return overlapCount < maxConcurrent;
  });

  slots = filterSameDaySlots(slots, dateYmd);

  return slots;
}

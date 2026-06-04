import { APPOINTMENT_LEAD_MINUTES } from "@/lib/constants";
import { getClinicTodayYmd } from "@/lib/datetime";
import { parse, isAfter, addMinutes } from "date-fns";

export function filterSameDaySlots(slots: string[], dateYmd: string): string[] {
  const today = getClinicTodayYmd();
  if (dateYmd !== today || slots.length === 0) return slots;

  const cutoff = addMinutes(new Date(), APPOINTMENT_LEAD_MINUTES);

  return slots.filter((slot) => {
    const normalized = slot.trim().slice(0, 5);
    const slotDt = parse(`${dateYmd} ${normalized}`, "yyyy-MM-dd HH:mm", new Date());
    return isAfter(slotDt, cutoff) || slotDt.getTime() === cutoff.getTime();
  });
}

export function generateTimeSlots(
  startTime: string,
  endTime: string,
  durationMinutes: number
): string[] {
  const slots: string[] = [];
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  let cursor = sh * 60 + sm;
  const end = eh * 60 + em;

  while (cursor + durationMinutes <= end) {
    const h = Math.floor(cursor / 60);
    const m = cursor % 60;
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    cursor += durationMinutes;
  }
  return slots;
}

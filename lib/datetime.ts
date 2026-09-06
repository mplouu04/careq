import { addDays } from "date-fns";
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";

/** Current date/time as a Date whose local fields reflect the clinic timezone */
export function getClinicNow(): Date {
  return toZonedTime(new Date(), TIMEZONE);
}

/** Today's date YYYY-MM-DD in clinic timezone */
export function getClinicTodayYmd(): string {
  return formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
}

/**
 * Add (or subtract) calendar days in the clinic timezone.
 * Uses noon to avoid DST midnight edges; date-fns handles month length / leap years.
 */
export function addClinicDays(ymd: string, amount: number): string {
  const noon = fromZonedTime(`${ymd}T12:00:00`, TIMEZONE);
  return formatInTimeZone(addDays(noon, amount), TIMEZONE, "yyyy-MM-dd");
}

/** Start of clinic day as UTC ISO string for DB filters */
export function getClinicDayStartIso(ymd?: string): string {
  const day = ymd ?? getClinicTodayYmd();
  return fromZonedTime(`${day}T00:00:00`, TIMEZONE).toISOString();
}

/** End of clinic day as UTC ISO string for DB filters */
export function getClinicDayEndIso(ymd?: string): string {
  const day = ymd ?? getClinicTodayYmd();
  return fromZonedTime(`${day}T23:59:59.999`, TIMEZONE).toISOString();
}

/** Day of week 0–6 (Sunday–Saturday) for a YYYY-MM-DD date in clinic TZ */
export function getClinicDayOfWeek(dateYmd: string): number {
  const noon = fromZonedTime(`${dateYmd}T12:00:00`, TIMEZONE);
  return noon.getUTCDay();
}

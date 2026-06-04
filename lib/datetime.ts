import { formatInTimeZone, fromZonedTime } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";

/** Today's date YYYY-MM-DD in clinic timezone */
export function getClinicTodayYmd(): string {
  return formatInTimeZone(new Date(), TIMEZONE, "yyyy-MM-dd");
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

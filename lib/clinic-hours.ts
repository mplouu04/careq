import { getEnvSafe } from "@/lib/env";

/** Default clinic hours in local clinic timezone (24h). Override via env if needed. */
const DEFAULT_OPEN_HOUR = 8;
const DEFAULT_CLOSE_HOUR = 17;

export function isClinicOpenNow(now = new Date()): boolean {
  const env = getEnvSafe();
  const tz = env?.NEXT_PUBLIC_TIMEZONE ?? "Asia/Manila";
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    hour12: false,
    weekday: "short",
  }).formatToParts(now);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const weekday = parts.find((p) => p.type === "weekday")?.value ?? "";

  if (weekday === "Sun") return false;
  return hour >= DEFAULT_OPEN_HOUR && hour < DEFAULT_CLOSE_HOUR;
}

export function clinicHoursLabel(): string {
  return `Mon–Sat ${DEFAULT_OPEN_HOUR}:00–${DEFAULT_CLOSE_HOUR}:00`;
}

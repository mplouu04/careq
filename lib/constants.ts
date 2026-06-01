export const TIMEZONE =
  process.env.NEXT_PUBLIC_TIMEZONE ?? "Asia/Manila";

export const APPOINTMENT_LEAD_MINUTES = Number(
  process.env.NEXT_PUBLIC_APPOINTMENT_LEAD_MINUTES ?? 30
);

export const CHECKIN_TYPE = {
  APPOINTMENT: 1,
  WALK_IN: 2,
} as const;

export const STAFF_ROLES = [
  "admin",
  "doctor",
  "nurse",
  "receptionist",
] as const;

export type StaffRole = (typeof STAFF_ROLES)[number];

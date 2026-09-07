import { getEnvSafe } from "@/lib/env";
import { clinicHoursLabel } from "@/lib/clinic-hours";

/** Public-facing clinic identity for notices, footer, and emails. */
export type ClinicPublicInfo = {
  name: string;
  address: string | null;
  phone: string | null;
  privacyEmail: string | null;
  hoursLabel: string;
  appUrl: string | null;
};

export function getClinicPublicInfo(): ClinicPublicInfo {
  const env = getEnvSafe();
  return {
    name: env?.CLINIC_NAME?.trim() || "CAREQ Clinic",
    address: env?.CLINIC_ADDRESS?.trim() || null,
    phone: env?.CLINIC_PHONE?.trim() || null,
    privacyEmail: env?.CLINIC_PRIVACY_EMAIL?.trim() || null,
    hoursLabel: clinicHoursLabel(),
    appUrl: env?.NEXT_PUBLIC_APP_URL?.trim() || null,
  };
}

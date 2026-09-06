import { z } from "zod";
import { extractPhoneLast7, normalizePhone } from "@/lib/phone";

/** Letters only; spaces, hyphens, apostrophes allowed between letter groups. Length 2–50. */
export const PATIENT_NAME_PATTERN = /^[A-Za-z]+(?:[ '\-][A-Za-z]+)*$/;
export const PATIENT_NAME_PATTERN_HTML = "[A-Za-z]+([ '\\-][A-Za-z]+)*";
export const PATIENT_PHONE_PATTERN = /^09\d{9}$/;
export const PATIENT_MIN_AGE = 18;

export function ageFromDobYmd(ymd: string, todayYmd?: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  const dob = new Date(y, m - 1, d);
  if (dob.getFullYear() !== y || dob.getMonth() !== m - 1 || dob.getDate() !== d) {
    return null;
  }
  const today = todayYmd
    ? (() => {
        const [ty, tm, td] = todayYmd.split("-").map(Number);
        return new Date(ty, tm - 1, td);
      })()
    : new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age -= 1;
  }
  return age;
}

/** Max DOB (YYYY-MM-DD) for someone who is at least PATIENT_MIN_AGE today. */
export function maxDobForMinAge(todayYmd?: string, minAge = PATIENT_MIN_AGE): string {
  const today = todayYmd
    ? (() => {
        const [ty, tm, td] = todayYmd.split("-").map(Number);
        return new Date(ty, tm - 1, td);
      })()
    : new Date();
  const max = new Date(today.getFullYear() - minAge, today.getMonth(), today.getDate());
  const yyyy = max.getFullYear();
  const mm = String(max.getMonth() + 1).padStart(2, "0");
  const dd = String(max.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export const PatientNameSchema = z
  .string()
  .trim()
  .min(2, "Must be at least 2 characters")
  .max(50, "Must be at most 50 characters")
  .regex(
    PATIENT_NAME_PATTERN,
    "Use letters only (spaces, hyphens, and apostrophes allowed)"
  );

export const PatientDobSchema = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD")
  .superRefine((ymd, ctx) => {
    const age = ageFromDobYmd(ymd);
    if (age === null) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date of birth" });
      return;
    }
    const year = parseInt(ymd.slice(0, 4), 10);
    if (year < 1900) {
      ctx.addIssue({ code: "custom", message: "Date of birth must be 1900 or later" });
      return;
    }
    const today = new Date();
    const todayYmd = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    if (ymd > todayYmd) {
      ctx.addIssue({ code: "custom", message: "Date of birth cannot be in the future" });
      return;
    }
    if (age < PATIENT_MIN_AGE) {
      ctx.addIssue({
        code: "custom",
        message: `You must be at least ${PATIENT_MIN_AGE} years old`,
      });
    }
  });

export const PatientAddressSchema = z
  .string()
  .trim()
  .min(10, "Address must be at least 10 characters")
  .max(255, "Address must be at most 255 characters")
  .refine((s) => /[A-Za-z]/.test(s), {
    message: "Address must include at least one letter",
  });

export const PatientPhoneSchema = z
  .string()
  .trim()
  .transform((s) => normalizePhone(s))
  .refine((s) => PATIENT_PHONE_PATTERN.test(s), {
    message: "Enter an 11-digit mobile number starting with 09",
  });

export const PatientEmailSchema = z.preprocess(
  (v) => (v == null ? "" : String(v).trim()),
  z.string().min(1, "Email is required").email("Enter a valid email address")
);

export const PatientGenderSchema = z.string().trim().min(1, "Gender is required");

/** Presence only — UI / service enforce truthy consent where required. */
export const PatientConsentSchema = z.union([z.boolean(), z.string()]);

/** Shared guest/register patient detail fields (trimmed + validated). */
export const GuestPatientDetailsSchema = z.object({
  firstName: PatientNameSchema,
  lastName: PatientNameSchema,
  dob: PatientDobSchema,
  gender: PatientGenderSchema,
  phone: PatientPhoneSchema,
  address: PatientAddressSchema,
  consent: PatientConsentSchema,
  email: PatientEmailSchema,
});

export type GuestPatientDetails = z.infer<typeof GuestPatientDetailsSchema>;

/** Parse guest details and return a field → message map for form UI. */
export function parseGuestPatientFieldErrors(
  input: Record<string, unknown>
): Record<string, string> {
  const result = GuestPatientDetailsSchema.safeParse(input);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = String(issue.path[0] ?? "");
    if (key && !errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export const RegisterPatientSchema = z.object({
  firstName: PatientNameSchema,
  lastName: PatientNameSchema,
  dob: PatientDobSchema,
  gender: PatientGenderSchema,
  phone: PatientPhoneSchema,
  address: PatientAddressSchema,
  consent: PatientConsentSchema,
  email: PatientEmailSchema,
});

export const PatientSearchSchema = z.object({
  term: z.string().min(1),
  dob: z.string().optional(),
});

export const PatientVerifySchema = z.object({
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must be YYYY-MM-DD"),
  phoneLast7: z
    .string()
    .transform((s) => extractPhoneLast7(s))
    .refine((s) => /^\d{7}$/.test(s), "Phone must produce exactly 7 digits after normalization"),
});

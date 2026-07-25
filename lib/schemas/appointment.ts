import { z } from "zod";
import {
  PatientAddressSchema,
  PatientConsentSchema,
  PatientDobSchema,
  PatientEmailSchema,
  PatientGenderSchema,
  PatientNameSchema,
  PatientPhoneSchema,
} from "@/lib/schemas/patient";

export const CancelAppointmentSchema = z.object({
  action: z.literal("cancel"),
  reference: z.string().min(1),
  phone: z.string().min(1),
});

export const StaffUpdateAppointmentSchema = z.object({
  action: z.literal("staff_update"),
  checkinId: z.coerce.number().int().positive(),
  status: z.enum(["confirm", "cancel", "no_show"]),
});

const guestFields = {
  firstName: PatientNameSchema,
  lastName: PatientNameSchema,
  dob: PatientDobSchema,
  gender: PatientGenderSchema,
  address: PatientAddressSchema,
  phone: PatientPhoneSchema,
  consent: PatientConsentSchema,
} as const;

export const BookAppointmentSchema = z
  .object({
    preferredDoctor: z.string().uuid(),
    appointmentType: z.union([z.string(), z.number()]),
    appointmentDate: z.string().min(1),
    appointmentTime: z.string().min(1),
    termsAgreement: z.union([z.boolean(), z.string(), z.literal("on")]),
    patient_id: z.union([z.string(), z.number()]).optional(),
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    dob: z.string().optional(),
    gender: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    email: PatientEmailSchema.optional(),
    consent: z.union([z.boolean(), z.string()]).optional(),
    reason: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.patient_id) return;
    for (const [field, schema] of Object.entries(guestFields)) {
      const value = data[field as keyof typeof data];
      const parsed = schema.safeParse(value);
      if (!parsed.success) {
        ctx.addIssue({
          code: "custom",
          message: parsed.error.issues[0]?.message ?? `Invalid field for new booking: ${field}`,
          path: [field],
        });
      }
    }
  });

export const CancelAppointmentByRefSchema = z.object({
  phone: z.string().min(1),
});

export const PatientLookupSchema = z.object({
  phone: z.string().min(1),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const ReferenceLookupSchema = z.object({
  reference: z.string().min(3).max(30).regex(/^[A-Za-z0-9\-]+$/),
});

export const ReferencePhoneLookupSchema = z.object({
  reference: z.string().min(1),
  phone: z.string().min(1),
});

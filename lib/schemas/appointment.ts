import { z } from "zod";

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
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.string().min(1),
  address: z.string().min(1),
  phone: z.string().min(1),
  consent: z.union([z.boolean(), z.string()]),
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
    email: z.string().email().optional().or(z.literal("")),
    consent: z.union([z.boolean(), z.string()]).optional(),
    reason: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.patient_id) return;
    for (const [field, schema] of Object.entries(guestFields)) {
      const value = data[field as keyof typeof data];
      if (!schema.safeParse(value).success) {
        ctx.addIssue({
          code: "custom",
          message: `Missing field for new booking: ${field}`,
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

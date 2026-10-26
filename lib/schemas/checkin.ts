import { z } from "zod";

export const AppointmentCheckinSchema = z.object({
  appointmentId: z.union([z.string(), z.number()]),
  phone: z.string().min(1),
});

export const WalkInCheckinSchema = z.object({
  type: z.literal("walk-in"),
  verifyToken: z.string().uuid(),
  appointmentType: z.union([z.string(), z.number()]),
  additionalinfo: z.string().min(1),
  termsAgreement: z.union([z.boolean(), z.string(), z.literal("on")]),
  /** Preferred doctor; omit or empty = first available (staff assigns at Call). */
  preferredDoctorId: z.string().uuid().optional().nullable(),
});

export const CheckinBodySchema = z.union([
  AppointmentCheckinSchema,
  WalkInCheckinSchema,
]);

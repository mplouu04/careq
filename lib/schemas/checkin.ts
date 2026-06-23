import { z } from "zod";

export const AppointmentCheckinSchema = z.object({
  appointmentId: z.union([z.string(), z.number()]),
});

export const WalkInCheckinSchema = z.object({
  type: z.literal("walk-in"),
  verifyToken: z.string().uuid(),
  appointmentType: z.union([z.string(), z.number()]),
  additionalinfo: z.string().min(1),
  termsAgreement: z.union([z.boolean(), z.string(), z.literal("on")]),
});

export const CheckinBodySchema = z.union([
  AppointmentCheckinSchema,
  WalkInCheckinSchema,
]);

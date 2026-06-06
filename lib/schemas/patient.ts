import { z } from "zod";

export const RegisterPatientSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  gender: z.string().min(1),
  phone: z.string().min(1),
  address: z.string().min(1).max(255),
  consent: z.union([z.boolean(), z.string()]),
  email: z.string().email().optional().or(z.literal("")),
});

export const PatientSearchSchema = z.object({
  term: z.string().min(1),
  dob: z.string().optional(),
});

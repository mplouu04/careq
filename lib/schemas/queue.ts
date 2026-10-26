import { z } from "zod";

export const PullForNurseSchema = z.object({
  // empty body ok — queue id from path
});

export const CompleteTriageSchema = z.object({
  assignedDoctorId: z.string().uuid(),
  bpSystolic: z.number().int().min(50).max(250).optional().nullable(),
  bpDiastolic: z.number().int().min(30).max(150).optional().nullable(),
  temperatureC: z.number().min(30).max(45).optional().nullable(),
  triageNotes: z.string().max(1000).optional().nullable(),
});

export const QueueActionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("call_next"),
    queueId: z.number().int().positive(),
    doctorId: z.string().uuid(),
    roomNumber: z.union([z.string(), z.number()]),
  }),
  z.object({
    action: z.literal("skip"),
    queueId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("recall"),
    queueId: z.number().int().positive(),
    doctorId: z.string().uuid(),
    roomNumber: z.union([z.string(), z.number()]),
  }),
  z.object({
    action: z.literal("mark_no_show"),
    queueId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("mark_done"),
    queueId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("mark_present"),
    queueId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("return_to_queue"),
    queueId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("pull_for_nurse"),
    queueId: z.number().int().positive(),
  }),
  z.object({
    action: z.literal("complete_triage"),
    queueId: z.number().int().positive(),
    assignedDoctorId: z.string().uuid(),
    bpSystolic: z.number().int().min(50).max(250).optional().nullable(),
    bpDiastolic: z.number().int().min(30).max(150).optional().nullable(),
    temperatureC: z.number().min(30).max(45).optional().nullable(),
    triageNotes: z.string().max(1000).optional().nullable(),
  }),
  z.object({
    action: z.literal("get_analytics"),
  }),
  z.object({
    action: z.literal("get_report"),
  }),
  z.object({
    action: z.literal("reset_daily"),
  }),
  z.object({
    action: z.literal("purge_history"),
  }),
]);

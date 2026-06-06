import { z } from "zod";

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

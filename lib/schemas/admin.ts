import { z } from "zod";
import { STAFF_ROLES } from "@/lib/constants";

const staffRoleEnum = z.enum(STAFF_ROLES);

export const RegisterStaffSchema = z.object({
  action: z.literal("register"),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8),
  role: staffRoleEnum,
});

export const UpdateStaffSchema = z.object({
  action: z.literal("update"),
  id: z.string().uuid(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  role: staffRoleEnum,
});

export const ToggleStaffActiveSchema = z.object({
  action: z.literal("toggle_active"),
  id: z.string().uuid(),
});

export const StaffActionSchema = z.discriminatedUnion("action", [
  RegisterStaffSchema,
  UpdateStaffSchema,
  ToggleStaffActiveSchema,
]);

export const AddDisplayScreenSchema = z.object({
  action: z.literal("add"),
  display_name: z.string().min(1),
  location: z.string().min(1),
  show_wait_time: z.boolean().optional(),
  show_priority: z.boolean().optional(),
  theme_color: z.string().optional(),
});

export const ToggleDisplayScreenSchema = z.object({
  action: z.literal("toggle"),
  id: z.number().int().positive(),
});

export const UpdateDisplayScreenSchema = z.object({
  action: z.literal("update"),
  id: z.number().int().positive(),
  display_name: z.string().min(1),
  location: z.string().min(1),
  show_wait_time: z.boolean().optional(),
  show_priority: z.boolean().optional(),
  theme_color: z.string().optional(),
  is_active: z.boolean().optional(),
});

export const DeleteDisplayScreenSchema = z.object({
  action: z.literal("delete"),
  id: z.number().int().positive(),
});

export const DisplaySettingsActionSchema = z.discriminatedUnion("action", [
  AddDisplayScreenSchema,
  ToggleDisplayScreenSchema,
  UpdateDisplayScreenSchema,
  DeleteDisplayScreenSchema,
]);

export const QueueCallBodySchema = z.object({
  doctorId: z.string().uuid(),
  roomNumber: z.union([z.string(), z.number()]),
});

export const QueueRecallBodySchema = QueueCallBodySchema;

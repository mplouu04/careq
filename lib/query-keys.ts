export const queryKeys = {
  doctors: {
    all: ["doctors"] as const,
    list: () => [...queryKeys.doctors.all, "list"] as const,
    availability: (doctorId: string, date: string, typeId: string, duration: number) =>
      [...queryKeys.doctors.all, "availability", doctorId, date, typeId, duration] as const,
  },
  appointmentTypes: {
    all: ["appointment-types"] as const,
    list: (opts?: { all?: boolean }) =>
      [...queryKeys.appointmentTypes.all, "list", opts?.all ? "all" : "active"] as const,
  },
  rooms: {
    all: ["rooms"] as const,
    list: (opts?: { all?: boolean }) =>
      [...queryKeys.rooms.all, "list", opts?.all ? "all" : "active"] as const,
  },
  queue: {
    all: ["queue"] as const,
    staff: () => [...queryKeys.queue.all, "staff"] as const,
    analytics: () => [...queryKeys.queue.all, "analytics"] as const,
    public: (screenId?: string) =>
      [...queryKeys.queue.all, "public", screenId ?? "default"] as const,
    byRef: (ref: string) => [...queryKeys.queue.all, "ref", ref] as const,
  },
  admin: {
    all: ["admin"] as const,
    staff: () => [...queryKeys.admin.all, "staff"] as const,
    settings: () => [...queryKeys.admin.all, "settings"] as const,
    doctors: () => [...queryKeys.admin.all, "doctors"] as const,
    doctorSchedule: (doctorId: string) =>
      [...queryKeys.admin.all, "doctor-schedule", doctorId] as const,
    appointments: (filter: string) =>
      [...queryKeys.admin.all, "appointments", filter] as const,
  },
  appointments: {
    all: ["appointments"] as const,
    byPhone: (phone: string, dob: string) =>
      [...queryKeys.appointments.all, "phone", phone, dob] as const,
    byReference: (reference: string, phone: string) =>
      [...queryKeys.appointments.all, "reference", reference, phone] as const,
  },
} as const;

type ApiError = { error: string };

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string, init?: RequestInit) =>
    fetch(url, init).then((r) => parseJson<T>(r)),

  post: <T>(url: string, body: unknown) =>
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => parseJson<T>(r)),

  patch: <T>(url: string, body: unknown) =>
    fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).then((r) => parseJson<T>(r)),

  delete: <T>(url: string, body?: unknown) =>
    fetch(url, {
      method: "DELETE",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    }).then((r) => parseJson<T>(r)),
};

export type DoctorRow = {
  id: string;
  first_name: string;
  last_name: string;
  is_active?: boolean;
};

export type AppointmentTypeRow = {
  id: string;
  name: string;
  duration: number;
  description?: string | null;
  is_active?: boolean;
};

export type RoomRow = {
  id: string;
  name: string;
  description?: string | null;
  is_active?: boolean;
};

export type StaffQueuePayload = {
  appointment?: {
    waiting?: unknown[];
    inProgress?: unknown[];
    completed?: unknown[];
    noShow?: unknown[];
    avg_service_time?: number;
  };
};

export type PublicQueuePayload = {
  waiting?: unknown[];
  rooms?: unknown[];
  avg_service_time?: number;
  display?: {
    display_name: string;
    location: string;
    theme_color: string;
    show_wait_time: boolean;
    show_priority: boolean;
  };
};

export type AvailabilityPayload = {
  available_slots?: string[];
  slots?: string[];
  no_schedule?: boolean;
};

export const catalogApi = {
  doctors: () =>
    api.get<{ doctors: DoctorRow[] }>("/api/doctors", { cache: "no-store" }),

  appointmentTypes: (all = false) =>
    api.get<{ types: AppointmentTypeRow[] }>(
      all ? "/api/appointment-types?all=1" : "/api/appointment-types",
      { cache: "no-store" }
    ),

  rooms: (all = false) =>
    api.get<{ rooms: RoomRow[] }>(all ? "/api/rooms?all=1" : "/api/rooms"),

  availability: (params: {
    doctorId: string;
    date: string;
    durationMinutes: number;
    appointmentTypeId: string;
  }) => {
    const qs = new URLSearchParams({
      doctorId: params.doctorId,
      date: params.date,
      durationMinutes: String(params.durationMinutes),
      appointmentTypeId: params.appointmentTypeId,
    });
    return api.get<AvailabilityPayload>(`/api/doctors/availability?${qs}`);
  },
};

export const queueDataApi = {
  staff: () => api.get<StaffQueuePayload>("/api/queue"),

  public: (screenId?: string) => {
    const qs = screenId ? `?screenId=${encodeURIComponent(screenId)}` : "";
    return api.get<PublicQueuePayload>(`/api/queue/public${qs}`);
  },

  byRef: async (ref: string) => {
    const res = await fetch(`/api/queue?ref=${encodeURIComponent(ref)}`, {
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (res.status === 404 || (res.ok && !data.success)) {
      return { kind: "not_found" as const };
    }
    if (res.status === 429) {
      return { kind: "rate_limited" as const };
    }
    if (!res.ok || !data.success) {
      throw new Error((data.error as string) ?? `HTTP ${res.status}`);
    }
    return {
      kind: "ok" as const,
      queue: data.queue,
      position: (data.position as number | null) ?? null,
      est_wait_minutes: (data.est_wait_minutes as number | null) ?? null,
      room: (data.room as string) ?? "",
      doctor: (data.doctor as string) ?? "",
    };
  },

  autoComplete: () =>
    api.post<{ success?: boolean }>("/api/queue/public", { auto: true }).catch(() => ({})),
};

export const adminApi = {
  staff: () => api.get<{ staff: unknown[] }>("/api/admin/staff"),
  settings: () => api.get<{ screens: unknown[] }>("/api/admin/settings"),
  doctors: () => api.get<{ doctors: unknown[] }>("/api/admin/doctors"),
  doctorSchedule: (doctorId: string) =>
    api.get<{ schedules: unknown[] }>(
      `/api/admin/doctors?doctorId=${encodeURIComponent(doctorId)}`
    ),
  appointments: (filter: string) =>
    api.get<{ appointments: unknown[] }>(`/api/appointments?filter=${filter}`),

  toggleStaff: (id: string) =>
    api.post<{ is_active?: boolean; error?: string }>("/api/admin/staff", {
      action: "toggle_active",
      id,
    }),

  toggleAppointmentType: (id: string) =>
    api.post<{ success?: boolean }>("/api/appointment-types", {
      action: "toggle",
      id,
    }),

  toggleDisplay: (id: string) =>
    api.post<{ success?: boolean }>("/api/admin/settings", {
      action: "toggle",
      id,
    }),

  toggleRoom: (room: {
    id: string;
    name: string;
    description: string | null;
    is_active: boolean;
  }) =>
    api.post<{ success?: boolean }>("/api/rooms", {
      action: "update",
      id: room.id,
      name: room.name,
      description: room.description,
      is_active: !room.is_active,
    }),
};

export const appointmentsDataApi = {
  byPhone: (phone: string, dob: string) =>
    api.get<{ appointments: unknown[]; patientName?: string }>(
      `/api/appointments?phone=${encodeURIComponent(phone)}&dob=${encodeURIComponent(dob)}`
    ),

  byReference: (reference: string, phone: string) => {
    const params = new URLSearchParams({ reference, phone });
    return api.get<{ appointments: unknown[]; patientName?: string }>(
      `/api/appointments?${params.toString()}`
    );
  },
};

export const queueApi = {
  analytics: () =>
    api.get<{
      success: boolean;
      avg_service_time: number;
      served_today: number;
      waiting_count: number;
      history: { date: string; served: number }[];
    }>("/api/queue/analytics"),

  call: (queueId: number, doctorId: string, roomNumber: string | number) =>
    api.post<{ success: boolean }>(`/api/queue/${queueId}/call`, {
      doctorId,
      roomNumber,
    }),

  skip: (queueId: number) =>
    api.post<{ success: boolean }>(`/api/queue/${queueId}/skip`, {}),

  recall: (queueId: number, doctorId: string, roomNumber: string | number) =>
    api.post<{ success: boolean }>(`/api/queue/${queueId}/recall`, {
      doctorId,
      roomNumber,
    }),

  done: (queueId: number) =>
    api.post<{ success: boolean }>(`/api/queue/${queueId}/done`, {}),

  noShow: (queueId: number) =>
    api.post<{ success: boolean; message?: string }>(
      `/api/queue/${queueId}/no-show`,
      {}
    ),

  resetDaily: () =>
    api.post<{ success: boolean; cancelled: number }>("/api/queue/actions", {
      action: "reset_daily",
    }),

  purgeHistory: () =>
    api.post<{
      success: boolean;
      queue_deleted: number;
      checkins_deleted: number;
    }>("/api/queue/actions", { action: "purge_history" }),
};

export const appointmentApi = {
  cancel: (reference: string, phone: string) =>
    api.delete<{ success: boolean }>(
      `/api/appointments/${encodeURIComponent(reference)}`,
      { phone }
    ),
};

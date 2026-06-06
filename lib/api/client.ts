type ApiError = { error: string };

async function parseJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as ApiError;
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  get: <T>(url: string) => fetch(url).then((r) => parseJson<T>(r)),

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

export const queueApi = {
  analytics: () => api.get<{ success: boolean; avg_service_time: number; served_today: number; waiting_count: number; history: { date: string; served: number }[] }>("/api/queue/analytics"),

  call: (queueId: number, doctorId: string, roomNumber: string | number) =>
    api.post<{ success: boolean }>(`/api/queue/${queueId}/call`, { doctorId, roomNumber }),

  skip: (queueId: number) =>
    api.post<{ success: boolean }>(`/api/queue/${queueId}/skip`, {}),

  recall: (queueId: number, doctorId: string, roomNumber: string | number) =>
    api.post<{ success: boolean }>(`/api/queue/${queueId}/recall`, { doctorId, roomNumber }),

  done: (queueId: number) =>
    api.post<{ success: boolean }>(`/api/queue/${queueId}/done`, {}),

  noShow: (queueId: number) =>
    api.post<{ success: boolean; message?: string }>(`/api/queue/${queueId}/no-show`, {}),

  resetDaily: () =>
    api.post<{ success: boolean; cancelled: number }>("/api/queue/actions", { action: "reset_daily" }),

  purgeHistory: () =>
    api.post<{ success: boolean; queue_deleted: number; checkins_deleted: number }>(
      "/api/queue/actions",
      { action: "purge_history" }
    ),
};

export const appointmentApi = {
  cancel: (reference: string, phone: string) =>
    api.delete<{ success: boolean }>(
      `/api/appointments/${encodeURIComponent(reference)}`,
      { phone }
    ),
};

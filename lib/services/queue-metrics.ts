import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { format } from "date-fns";
import { addClinicDays, getClinicTodayYmd } from "@/lib/datetime";

const AVG_CACHE_TTL_MS = 45_000;
const DEFAULT_AVG_MINUTES = 10;

type AvgCacheEntry = { value: number; expiresAt: number };
const avgCache = new Map<string, AvgCacheEntry>();

function avgCacheKey(dayStart: string, dayEnd: string): string {
  return `${dayStart}|${dayEnd}`;
}

/** @internal test helper */
export function clearAvgServiceTimeCache(): void {
  avgCache.clear();
}

/** Fallback when RPC is unavailable — same JS reduce as before. */
async function getAvgServiceTimeFallback(
  dayStart: string,
  dayEnd: string,
  supabase: SupabaseClient
): Promise<number> {
  const { data: completed } = await supabase
    .from("queue")
    .select("called_at, completed_at")
    .eq("status", "completed")
    .gte("called_at", dayStart)
    .lte("called_at", dayEnd)
    .not("completed_at", "is", null)
    .not("called_at", "is", null);

  if (!completed?.length) return DEFAULT_AVG_MINUTES;

  const total = completed.reduce((sum, row) => {
    const start = new Date(row.called_at!).getTime();
    const end = new Date(row.completed_at!).getTime();
    return sum + (end - start) / 60000;
  }, 0);

  return Math.round(total / completed.length) || DEFAULT_AVG_MINUTES;
}

export async function getAvgServiceTime(
  dayStart: string,
  dayEnd: string,
  client?: SupabaseClient
): Promise<number> {
  const key = avgCacheKey(dayStart, dayEnd);
  const cached = avgCache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const supabase = client ?? createAdminClient();

  const { data, error } = await supabase.rpc("get_avg_service_minutes", {
    p_day_start: dayStart,
    p_day_end: dayEnd,
  });

  let value: number;
  if (error || data == null) {
    value = await getAvgServiceTimeFallback(dayStart, dayEnd, supabase);
  } else {
    const n = typeof data === "number" ? data : Number(data);
    value = Number.isFinite(n) && n > 0 ? Math.round(n) : DEFAULT_AVG_MINUTES;
  }

  avgCache.set(key, { value, expiresAt: Date.now() + AVG_CACHE_TTL_MS });
  return value;
}

export async function getQueueReport(dayStart: string, historyDays = 7) {
  const supabase = createAdminClient();
  const span = Math.max(1, historyDays);
  const today = getClinicTodayYmd();
  const historyStartDate = addClinicDays(today, -(span - 1));
  const historyStartIso = `${historyStartDate}T00:00:00`;
  const historyEndExclusive = `${addClinicDays(today, 1)}T00:00:00`;
  const dayEnd = new Date().toISOString();

  const countsByDay = new Map<string, number>();
  for (let i = 0; i < span; i++) {
    const d = addClinicDays(today, -(span - 1 - i));
    countsByDay.set(d, 0);
  }

  const [avgMinutes, waitingRes, historyRpc, servedRes] = await Promise.all([
    getAvgServiceTime(dayStart, dayEnd, supabase),
    supabase
      .from("queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "waiting")
      .eq("clinic_date", today),
    supabase.rpc("get_queue_served_by_day", {
      p_start: historyStartIso,
      p_end: historyEndExclusive,
    }),
    supabase
      .from("queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("called_at", dayStart)
      .not("completed_at", "is", null),
  ]);

  if (!historyRpc.error && Array.isArray(historyRpc.data)) {
    for (const row of historyRpc.data as { day: string; served: number | string }[]) {
      const day = String(row.day).slice(0, 10);
      if (countsByDay.has(day)) {
        countsByDay.set(day, Number(row.served) || 0);
      }
    }
  } else {
    const { data: historyRows } = await supabase
      .from("queue")
      .select("completed_at")
      .eq("status", "completed")
      .gte("completed_at", `${historyStartDate}T00:00:00`)
      .not("completed_at", "is", null);

    for (const row of historyRows ?? []) {
      if (!row.completed_at) continue;
      const day = format(new Date(row.completed_at), "yyyy-MM-dd");
      if (countsByDay.has(day)) {
        countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
      }
    }
  }

  return {
    avg_service_time: avgMinutes,
    served_today: servedRes.count ?? 0,
    waiting_count: waitingRes.count ?? 0,
    history: Array.from(countsByDay.entries()).map(([date, served]) => ({
      date,
      served,
    })),
  };
}

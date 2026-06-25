import { createAdminClient } from "@/lib/supabase/admin";
import type { SupabaseClient } from "@supabase/supabase-js";
import { format, subDays } from "date-fns";

export async function getAvgServiceTime(
  dayStart: string,
  dayEnd: string,
  client?: SupabaseClient
): Promise<number> {
  const supabase = client ?? createAdminClient();

  const { data: completed } = await supabase
    .from("queue")
    .select("called_at, completed_at")
    .eq("status", "completed")
    .gte("called_at", dayStart)
    .lte("called_at", dayEnd)
    .not("completed_at", "is", null)
    .not("called_at", "is", null);

  if (!completed?.length) return 10;

  const total = completed.reduce((sum, row) => {
    const start = new Date(row.called_at!).getTime();
    const end = new Date(row.completed_at!).getTime();
    return sum + (end - start) / 60000;
  }, 0);

  return Math.round(total / completed.length) || 10;
}

export async function getQueueReport(dayStart: string, historyDays = 7) {
  const supabase = createAdminClient();
  const span = Math.max(1, historyDays);

  const { data: completed } = await supabase
    .from("queue")
    .select("called_at, completed_at, created_at")
    .eq("status", "completed")
    .gte("called_at", dayStart)
    .not("completed_at", "is", null);

  let avgMinutes = 10;
  if (completed?.length) {
    const total = completed.reduce((sum, row) => {
      const start = new Date(row.called_at!).getTime();
      const end = new Date(row.completed_at!).getTime();
      return sum + (end - start) / 60000;
    }, 0);
    avgMinutes = Math.round(total / completed.length) || 10;
  }

  const { count: waiting } = await supabase
    .from("queue")
    .select("*", { count: "exact", head: true })
    .eq("status", "waiting")
    .gte("created_at", dayStart);

  const startDate = format(subDays(new Date(), span - 1), "yyyy-MM-dd");
  const { data: historyRows } = await supabase
    .from("queue")
    .select("completed_at")
    .eq("status", "completed")
    .gte("completed_at", `${startDate}T00:00:00`)
    .not("completed_at", "is", null);

  const countsByDay = new Map<string, number>();
  for (let i = 0; i < span; i++) {
    const d = format(subDays(new Date(), span - 1 - i), "yyyy-MM-dd");
    countsByDay.set(d, 0);
  }

  for (const row of historyRows ?? []) {
    if (!row.completed_at) continue;
    const day = format(new Date(row.completed_at), "yyyy-MM-dd");
    if (countsByDay.has(day)) {
      countsByDay.set(day, (countsByDay.get(day) ?? 0) + 1);
    }
  }

  const history = Array.from(countsByDay.entries()).map(([date, served]) => ({
    date,
    served,
  }));

  return {
    avg_service_time: avgMinutes,
    served_today: completed?.length ?? 0,
    waiting_count: waiting ?? 0,
    history,
  };
}

import { createAdminClient } from "@/lib/supabase/admin";

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

export async function checkRateLimit(
  action: string,
  ip: string
): Promise<boolean> {
  const supabase = createAdminClient();
  const windowStart = new Date(Date.now() - WINDOW_MS).toISOString();

  const { data: existing } = await supabase
    .from("rate_limits")
    .select("id, request_count, window_start")
    .eq("action", action)
    .eq("ip_address", ip)
    .gte("window_start", windowStart)
    .maybeSingle();

  if (!existing) {
    await supabase.from("rate_limits").insert({
      action,
      ip_address: ip,
      request_count: 1,
      window_start: new Date().toISOString(),
    });
    return true;
  }

  if (existing.request_count >= MAX_REQUESTS) {
    return false;
  }

  await supabase
    .from("rate_limits")
    .update({ request_count: existing.request_count + 1 })
    .eq("id", existing.id);

  return true;
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

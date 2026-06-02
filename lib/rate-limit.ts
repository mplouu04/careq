import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Rate-limit check matching legacy pqms_rate_limit() behaviour.
 * @param action  action key (e.g. "patient_register")
 * @param ip      client IP
 * @param max     maximum requests in window (default 10)
 * @param windowSeconds  sliding window in seconds (default 60)
 * @returns true if within limit, false if exceeded
 */
export async function checkRateLimit(
  action: string,
  ip: string,
  max = 10,
  windowSeconds = 60
): Promise<boolean> {
  const supabase = createAdminClient();
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { data: existing } = await supabase
    .from("rate_limits")
    .select("id, request_count, window_start")
    .eq("action", action)
    .eq("ip_address", ip)
    .gte("window_start", windowStart)
    .order("window_start", { ascending: false })
    .maybeSingle();

  if (!existing) {
    await supabase.from("rate_limits").insert({
      action,
      ip_address: ip,
      request_count: 1,
      window_start: new Date().toISOString(),
    });
    // Clean up old rows for this action+ip
    await supabase
      .from("rate_limits")
      .delete()
      .eq("action", action)
      .eq("ip_address", ip)
      .lt("window_start", windowStart);
    return true;
  }

  if (existing.request_count >= max) {
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

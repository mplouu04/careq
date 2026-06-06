import { createAdminClient } from "@/lib/supabase/admin";
import { logWarn } from "@/lib/observability";

/**
 * Rate-limit check matching legacy pqms_rate_limit() behaviour.
 * Uses atomic PostgreSQL RPC when available.
 */
export async function checkRateLimit(
  action: string,
  ip: string,
  max = 10,
  windowSeconds = 60,
  failClosed = true
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("increment_rate_limit", {
      p_action: action,
      p_ip: ip,
      p_max: max,
      p_window_seconds: windowSeconds,
    });

    if (!error) {
      return data === true;
    }

    logWarn("[rate-limit] RPC unavailable, using fallback", { action, error: error.message });
    return fallbackRateLimit(action, ip, max, windowSeconds, failClosed);
  } catch (err) {
    logWarn("[rate-limit] Unexpected error", {
      action,
      error: err instanceof Error ? err.message : String(err),
    });
    return !failClosed;
  }
}

async function fallbackRateLimit(
  action: string,
  ip: string,
  max: number,
  windowSeconds: number,
  failClosed: boolean
): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

    const { data: existing, error: selectError } = await supabase
      .from("rate_limits")
      .select("id, request_count, window_start")
      .eq("action", action)
      .eq("ip_address", ip)
      .gte("window_start", windowStart)
      .order("window_start", { ascending: false })
      .maybeSingle();

    if (selectError) {
      return !failClosed;
    }

    if (!existing) {
      await supabase.from("rate_limits").insert({
        action,
        ip_address: ip,
        request_count: 1,
        window_start: new Date().toISOString(),
      });
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
  } catch {
    return !failClosed;
  }
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  );
}

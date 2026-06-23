import { createAdminClient } from "@/lib/supabase/admin";
import { logWarn } from "@/lib/observability";

export const PATIENT_VERIFY_RATE_LIMIT = { max: 5, windowSeconds: 60 } as const;

export const PATIENT_VERIFY_LOCKOUT = {
  maxFailures: 5,
  lockoutSeconds: 15 * 60,
} as const;

const VERIFY_FAILURES_ACTION = "patient_verify_failures";
const VERIFY_LOCKOUT_ACTION = "patient_verify_lockout";

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

/** Returns whether an IP is locked out after consecutive failed patient-verify lookups. */
export async function isVerificationLockedOut(
  ip: string
): Promise<{ locked: boolean; retryAfterSeconds: number }> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("rate_limits")
      .select("window_start")
      .eq("action", VERIFY_LOCKOUT_ACTION)
      .eq("ip_address", ip)
      .order("window_start", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return { locked: false, retryAfterSeconds: 0 };
    }

    const lockoutEnd =
      new Date(data.window_start).getTime() +
      PATIENT_VERIFY_LOCKOUT.lockoutSeconds * 1000;
    const remainingMs = lockoutEnd - Date.now();

    if (remainingMs > 0) {
      return { locked: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
    }

    await clearVerificationFailures(ip);
    return { locked: false, retryAfterSeconds: 0 };
  } catch (err) {
    logWarn("[rate-limit] Lockout check failed", {
      ip,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      locked: true,
      retryAfterSeconds: PATIENT_VERIFY_LOCKOUT.lockoutSeconds,
    };
  }
}

/** Increments consecutive failed lookups; triggers lockout after maxFailures. */
export async function recordVerificationFailure(ip: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    const { data: existing, error: selectError } = await supabase
      .from("rate_limits")
      .select("id, request_count")
      .eq("action", VERIFY_FAILURES_ACTION)
      .eq("ip_address", ip)
      .maybeSingle();

    if (selectError) {
      return;
    }

    const newCount = (existing?.request_count ?? 0) + 1;
    const now = new Date().toISOString();

    if (existing) {
      await supabase
        .from("rate_limits")
        .update({ request_count: newCount, window_start: now })
        .eq("id", existing.id);
    } else {
      await supabase.from("rate_limits").insert({
        action: VERIFY_FAILURES_ACTION,
        ip_address: ip,
        request_count: newCount,
        window_start: now,
      });
    }

    if (newCount >= PATIENT_VERIFY_LOCKOUT.maxFailures) {
      await supabase
        .from("rate_limits")
        .delete()
        .eq("action", VERIFY_LOCKOUT_ACTION)
        .eq("ip_address", ip);
      await supabase.from("rate_limits").insert({
        action: VERIFY_LOCKOUT_ACTION,
        ip_address: ip,
        request_count: 1,
        window_start: now,
      });
    }
  } catch (err) {
    logWarn("[rate-limit] Failed to record verification failure", {
      ip,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/** Clears failure streak and lockout after a successful patient-verify lookup. */
export async function clearVerificationFailures(ip: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase
      .from("rate_limits")
      .delete()
      .eq("ip_address", ip)
      .in("action", [VERIFY_FAILURES_ACTION, VERIFY_LOCKOUT_ACTION]);
  } catch (err) {
    logWarn("[rate-limit] Failed to clear verification failures", {
      ip,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEnvSafe } from "@/lib/env";
import { withRateLimit } from "@/lib/api/with-auth";

export const dynamic = "force-dynamic";

function detailAuthorized(request: Request): boolean {
  const env = getEnvSafe();
  const secret = env?.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

async function healthHandler(request: Request) {
  const { searchParams } = new URL(request.url);
  const wantDetail = searchParams.get("detail") === "1";
  const detail = wantDetail && detailAuthorized(request);
  const env = getEnvSafe();
  let healthy = Boolean(env);

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("checkin_types").select("id").limit(1);
    if (error) healthy = false;
  } catch {
    healthy = false;
  }

  if (!detail) {
    if (wantDetail && !detailAuthorized(request)) {
      return NextResponse.json(
        { status: healthy ? "ok" : "degraded", error: "detail requires authorization" },
        { status: healthy ? 200 : 503 }
      );
    }
    return NextResponse.json(
      { status: healthy ? "ok" : "degraded", timestamp: new Date().toISOString() },
      { status: healthy ? 200 : 503 }
    );
  }

  const checks: Record<string, string> = {};
  if (!env) {
    checks.env = "invalid";
    healthy = false;
  } else {
    checks.env = "ok";
    checks.cron = env.CRON_SECRET ? "configured" : "missing";
    checks.email =
      env.RESEND_API_KEY && env.RESEND_FROM_EMAIL ? "configured" : "not_configured";
    if (env.VERCEL_ENV === "production" && !env.CRON_SECRET) {
      checks.cron = "missing_in_production";
      healthy = false;
    }
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase.from("checkin_types").select("id").limit(1);
    checks.database = error ? `error: ${error.message}` : "ok";
    if (error) healthy = false;
  } catch (err) {
    checks.database = err instanceof Error ? err.message : "unreachable";
    healthy = false;
  }

  return NextResponse.json(
    {
      status: healthy ? "healthy" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 }
  );
}

export const GET = withRateLimit("health_check", healthHandler, {
  max: 60,
  windowSeconds: 60,
  failClosed: false,
});

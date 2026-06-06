import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEnvSafe } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};
  let healthy = true;

  const env = getEnvSafe();
  if (!env) {
    checks.env = "invalid";
    healthy = false;
  } else {
    checks.env = "ok";
    checks.cron = env.CRON_SECRET ? "configured" : "missing";
    checks.email = env.RESEND_API_KEY && env.RESEND_FROM_EMAIL ? "configured" : "not_configured";
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

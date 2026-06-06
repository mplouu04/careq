import { NextResponse } from "next/server";
import { verifyCronAuth } from "@/lib/cron-auth";
import { purgeOldLogs } from "@/lib/services/retention.service";
import { captureException } from "@/lib/observability";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authError = verifyCronAuth(request);
  if (authError) return authError;

  const started = Date.now();

  try {
    const result = await purgeOldLogs();
    return NextResponse.json({
      success: true,
      ...result,
      duration_ms: Date.now() - started,
    });
  } catch (err) {
    captureException(err, { route: "/api/cron/retention" });
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Retention job failed" },
      { status: 500 }
    );
  }
}

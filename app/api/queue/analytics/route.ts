import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/api/with-auth";
import { getAnalyticsReport } from "@/lib/services/queue.service";

export const dynamic = "force-dynamic";

export const GET = withStaffAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") ?? "7", 10);
  const report = await getAnalyticsReport();

  return NextResponse.json({
    success: true,
    days: Number.isNaN(days) ? 7 : days,
    avg_service_time: report.avg_service_time,
    served_today: report.served_today,
    waiting_count: report.waiting_count,
    history: report.history,
  });
});

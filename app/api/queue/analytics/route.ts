import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/api/with-auth";
import { getAnalyticsReport } from "@/lib/services/queue.service";

export const dynamic = "force-dynamic";

export const GET = withStaffAuth(async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const daysRaw = parseInt(searchParams.get("days") ?? "7", 10);
  const days = Number.isNaN(daysRaw) ? 7 : daysRaw;
  const report = await getAnalyticsReport(days);

  return NextResponse.json({
    success: true,
    days,
    avg_service_time: report.avg_service_time,
    served_today: report.served_today,
    waiting_count: report.waiting_count,
    history: report.history,
  });
});

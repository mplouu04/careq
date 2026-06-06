import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/api/with-auth";
import { getClientIp } from "@/lib/rate-limit";
import { markDone } from "@/lib/services/queue.service";

export const dynamic = "force-dynamic";

export const POST = withStaffAuth(async (request: Request, context?: { params?: Record<string, string> }) => {
  const queueId = parseInt(context?.params?.id ?? "", 10);
  if (Number.isNaN(queueId) || queueId <= 0) {
    return NextResponse.json({ error: "Invalid queue id" }, { status: 400 });
  }

  const staffSession = (request as Request & { staffSession?: { userId: string } }).staffSession!;
  const result = await markDone({
    queueId,
    userId: staffSession.userId,
    ip: getClientIp(request),
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ success: true });
});

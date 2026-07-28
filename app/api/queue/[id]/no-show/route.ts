import { withStaffAuth } from "@/lib/api/with-auth";
import { getClientIp } from "@/lib/rate-limit";
import { markNoShow } from "@/lib/services/queue.service";
import { jsonServiceResult, parseQueueIdParam } from "@/lib/api/queue-commands";

export const dynamic = "force-dynamic";

export const POST = withStaffAuth(async (request: Request, context?: { params?: Record<string, string> }) => {
  const parsedId = parseQueueIdParam(context?.params);
  if ("error" in parsedId) return parsedId.error;

  const staffSession = (request as Request & { staffSession?: { userId: string } }).staffSession!;
  const result = await markNoShow({
    queueId: parsedId.queueId,
    userId: staffSession.userId,
    ip: getClientIp(request),
  });

  return jsonServiceResult(result);
});

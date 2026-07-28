import { withStaffAuth } from "@/lib/api/with-auth";
import { parseJsonBody } from "@/lib/api/parse-body";
import { getClientIp } from "@/lib/rate-limit";
import { QueueCallBodySchema } from "@/lib/schemas/admin";
import { callNextPatient } from "@/lib/services/queue.service";
import { jsonServiceResult, parseQueueIdParam } from "@/lib/api/queue-commands";

export const dynamic = "force-dynamic";

export const POST = withStaffAuth(async (request: Request, context?: { params?: Record<string, string> }) => {
  const parsedId = parseQueueIdParam(context?.params);
  if ("error" in parsedId) return parsedId.error;

  const parsed = await parseJsonBody(request, QueueCallBodySchema);
  if ("error" in parsed) return parsed.error;

  const staffSession = (request as Request & { staffSession?: { userId: string } }).staffSession!;
  const result = await callNextPatient({
    queueId: parsedId.queueId,
    doctorId: parsed.data.doctorId,
    roomNumber: parsed.data.roomNumber,
    userId: staffSession.userId,
    ip: getClientIp(request),
  });

  return jsonServiceResult(result);
});

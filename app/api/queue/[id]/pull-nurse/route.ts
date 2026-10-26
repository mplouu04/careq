import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/api/with-auth";
import { getClientIp } from "@/lib/rate-limit";
import { pullForNurse } from "@/lib/services/queue.service";
import { jsonServiceResult, parseQueueIdParam } from "@/lib/api/queue-commands";

export const dynamic = "force-dynamic";

const TRIAGE_ROLES = ["nurse", "admin", "receptionist"] as const;

export const POST = withStaffAuth(async (request: Request, context?: { params?: Record<string, string> }) => {
  const parsedId = parseQueueIdParam(context?.params);
  if ("error" in parsedId) return parsedId.error;

  const staffSession = (
    request as Request & {
      staffSession?: { userId: string; staff: { role: string } };
    }
  ).staffSession!;

  if (!TRIAGE_ROLES.includes(staffSession.staff.role as (typeof TRIAGE_ROLES)[number])) {
    return NextResponse.json(
      { error: "Only nurse, receptionist, or admin can pull for triage" },
      { status: 403 }
    );
  }

  const result = await pullForNurse({
    queueId: parsedId.queueId,
    userId: staffSession.userId,
    ip: getClientIp(request),
  });

  return jsonServiceResult(result);
}, [...TRIAGE_ROLES]);

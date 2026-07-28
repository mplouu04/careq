import { NextResponse } from "next/server";

/** Shared queue-id parsing for /api/queue/[id]/* thin aliases of /api/queue/actions. */
export function parseQueueIdParam(
  params?: Record<string, string>
): { queueId: number } | { error: NextResponse } {
  const queueId = parseInt(params?.id ?? "", 10);
  if (Number.isNaN(queueId) || queueId <= 0) {
    return {
      error: NextResponse.json({ error: "Invalid queue id" }, { status: 400 }),
    };
  }
  return { queueId };
}

export function jsonServiceResult(
  result: { error: string; status: number } | { success: true; message?: string }
) {
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  if (result.message) {
    return NextResponse.json({ success: true, message: result.message });
  }
  return NextResponse.json({ success: true });
}

import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/api/with-auth";
import { parseJsonBody } from "@/lib/api/parse-body";
import { getClientIp } from "@/lib/rate-limit";
import { QueueActionSchema } from "@/lib/schemas/queue";
import {
  callNextPatient,
  getAnalyticsReport,
  markDone,
  markNoShow,
  purgeQueueHistory,
  recallPatient,
  resetDailyQueue,
  skipPatient,
} from "@/lib/services/queue.service";

export const dynamic = "force-dynamic";

type StaffRequest = Request & {
  staffSession?: { userId: string; staff: { role: string } };
};

function staffContext(request: Request) {
  const req = request as StaffRequest;
  return {
    userId: req.staffSession!.userId,
    role: req.staffSession!.staff.role,
    ip: getClientIp(request),
  };
}

export const POST = withStaffAuth(async (request: Request) => {
  const parsed = await parseJsonBody(request, QueueActionSchema);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data;
  const ctx = staffContext(request);

  switch (body.action) {
    case "call_next": {
      const result = await callNextPatient({
        queueId: body.queueId,
        doctorId: body.doctorId,
        roomNumber: body.roomNumber,
        userId: ctx.userId,
        ip: ctx.ip,
      });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true });
    }

    case "skip": {
      const result = await skipPatient({
        queueId: body.queueId,
        userId: ctx.userId,
        ip: ctx.ip,
      });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true });
    }

    case "recall": {
      const result = await recallPatient({
        queueId: body.queueId,
        doctorId: body.doctorId,
        roomNumber: body.roomNumber,
        userId: ctx.userId,
        ip: ctx.ip,
      });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true });
    }

    case "mark_no_show": {
      const result = await markNoShow({
        queueId: body.queueId,
        userId: ctx.userId,
        ip: ctx.ip,
      });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true, message: result.message });
    }

    case "mark_done": {
      const result = await markDone({
        queueId: body.queueId,
        userId: ctx.userId,
        ip: ctx.ip,
      });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json({ success: true });
    }

    case "get_analytics":
    case "get_report": {
      const report = await getAnalyticsReport();
      if (body.action === "get_analytics") {
        return NextResponse.json({
          success: true,
          avg_service_time: report.avg_service_time,
          served_today: report.served_today,
          waiting_count: report.waiting_count,
        });
      }
      return NextResponse.json(report);
    }

    case "reset_daily": {
      if (ctx.role !== "admin") {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
      }
      const result = await resetDailyQueue({ userId: ctx.userId, ip: ctx.ip });
      return NextResponse.json(result);
    }

    case "purge_history": {
      if (ctx.role !== "admin") {
        return NextResponse.json({ error: "Admin only" }, { status: 403 });
      }
      const result = await purgeQueueHistory({ userId: ctx.userId, ip: ctx.ip });
      return NextResponse.json(result);
    }

    default:
      return NextResponse.json({ error: "Invalid or missing action" }, { status: 400 });
  }
});

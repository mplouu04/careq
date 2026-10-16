import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/api/with-auth";
import { parseJsonBody } from "@/lib/api/parse-body";
import { DisplaySettingsActionSchema } from "@/lib/schemas/admin";
import { getClientIp } from "@/lib/rate-limit";
import {
  addDisplayScreen,
  deleteDisplayScreen,
  listDisplayScreens,
  toggleDisplayScreen,
  updateClinicSettings,
  updateDisplayScreen,
} from "@/lib/services/admin.service";
import { getNoShowGraceMinutes } from "@/lib/clinic-settings";

export const dynamic = "force-dynamic";

type StaffRequest = Request & {
  staffSession?: { userId: string };
};

function auditContext(request: Request) {
  const req = request as StaffRequest;
  return { userId: req.staffSession!.userId, ip: getClientIp(request) };
}

export const GET = withStaffAuth(async () => {
  const [screens, no_show_grace_minutes] = await Promise.all([
    listDisplayScreens(),
    getNoShowGraceMinutes(),
  ]);
  return NextResponse.json({ success: true, screens, no_show_grace_minutes });
}, ["admin"]);

export const POST = withStaffAuth(async (request: Request) => {
  const parsed = await parseJsonBody(request, DisplaySettingsActionSchema);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data;
  const audit = auditContext(request);

  switch (body.action) {
    case "add": {
      const result = await addDisplayScreen(body, audit);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json(result);
    }

    case "toggle": {
      const result = await toggleDisplayScreen(body.id, audit);
      return NextResponse.json(result);
    }

    case "update": {
      const result = await updateDisplayScreen(body, audit);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json(result);
    }

    case "delete": {
      const result = await deleteDisplayScreen(body.id, audit);
      return NextResponse.json(result);
    }

    case "update_clinic": {
      const result = await updateClinicSettings(body, audit);
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json(result);
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}, ["admin"]);

import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/api/with-auth";
import { parseJsonBody } from "@/lib/api/parse-body";
import { getClientIp } from "@/lib/rate-limit";
import { StaffActionSchema } from "@/lib/schemas/admin";
import {
  listStaff,
  registerStaff,
  toggleStaffActive,
  updateStaff,
} from "@/lib/services/admin.service";

export const dynamic = "force-dynamic";

export const GET = withStaffAuth(async () => {
  const staff = await listStaff();
  return NextResponse.json({ success: true, staff });
}, ["admin"]);

export const POST = withStaffAuth(async (request: Request) => {
  const parsed = await parseJsonBody(request, StaffActionSchema);
  if ("error" in parsed) return parsed.error;

  const body = parsed.data;
  const requestingUserId = (request as Request & { staffSession?: { userId: string } })
    .staffSession!.userId;
  const ip = getClientIp(request);

  switch (body.action) {
    case "register": {
      const result = await registerStaff({
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        password: body.password,
        role: body.role,
        requestingUserId,
        ip,
      });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json(result);
    }

    case "update": {
      const result = await updateStaff({
        id: body.id,
        firstName: body.firstName,
        lastName: body.lastName,
        email: body.email,
        role: body.role,
        requestingUserId,
        ip,
      });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json(result);
    }

    case "toggle_active": {
      const result = await toggleStaffActive({
        id: body.id,
        requestingUserId,
        ip,
      });
      if ("error" in result) {
        return NextResponse.json({ error: result.error }, { status: result.status });
      }
      return NextResponse.json(result);
    }

    default:
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }
}, ["admin"]);

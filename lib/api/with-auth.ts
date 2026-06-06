import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import type { StaffRole } from "@/lib/constants";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

type RouteContext = { params?: Record<string, string> };
type RouteHandler = (request: Request, context?: RouteContext) => Promise<Response>;

export function withStaffAuth(handler: RouteHandler, roles?: StaffRole[]): RouteHandler {
  return async (request, context) => {
    const auth = await requireStaff(roles);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    (request as Request & { staffSession?: typeof auth.session }).staffSession =
      auth.session;
    return handler(request, context);
  };
}

export function withRateLimit(
  action: string,
  handler: RouteHandler,
  options?: { max?: number; windowSeconds?: number; failClosed?: boolean }
): RouteHandler {
  const max = options?.max ?? 10;
  const windowSeconds = options?.windowSeconds ?? 60;
  const failClosed = options?.failClosed ?? true;

  return async (request, context) => {
    const ip = getClientIp(request);
    const allowed = await checkRateLimit(action, ip, max, windowSeconds, failClosed);
    if (!allowed) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }
    return handler(request, context);
  };
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

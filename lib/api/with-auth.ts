import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/auth";
import type { StaffRole } from "@/lib/constants";
import {
  checkRateLimit,
  getClientIp,
  isVerificationLockedOut,
  PATIENT_VERIFY_RATE_LIMIT,
} from "@/lib/rate-limit";

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

/** Rate limit (5/min) plus lockout gate for POST /api/patient-verify. */
export function withPatientVerifyRateLimit(handler: RouteHandler): RouteHandler {
  return async (request, context) => {
    const ip = getClientIp(request);
    const lockout = await isVerificationLockedOut(ip);
    if (lockout.locked) {
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(lockout.retryAfterSeconds) } }
      );
    }

    const allowed = await checkRateLimit(
      "patient_verify",
      ip,
      PATIENT_VERIFY_RATE_LIMIT.max,
      PATIENT_VERIFY_RATE_LIMIT.windowSeconds,
      true
    );
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(PATIENT_VERIFY_RATE_LIMIT.windowSeconds) },
        }
      );
    }

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
      return NextResponse.json(
        { error: "Too many requests" },
        { status: 429, headers: { "Retry-After": String(windowSeconds) } }
      );
    }
    return handler(request, context);
  };
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

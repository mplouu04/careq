import { NextResponse } from "next/server";

/**
 * Self-registration is NOT supported in CAREQ.
 * Only administrators can register new staff accounts via /api/admin/staff.
 *
 * This route returns 405 to prevent unauthorised staff creation.
 */
export async function POST() {
  return NextResponse.json(
    { error: "Self-registration is not allowed. Contact an administrator." },
    { status: 405 }
  );
}

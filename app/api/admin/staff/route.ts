import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireStaff(["admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("staff")
    .select("id, first_name, last_name, email, role, is_active, created_at")
    .order("last_name");

  return NextResponse.json({ success: true, staff: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireStaff(["admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const supabase = createAdminClient();
  const ip = getClientIp(request);
  const requestingUserId = auth.session.userId;

  // ── Register new staff (admin creates account) ────────────────────────────
  if (body.action === "register") {
    const required = ["firstName", "lastName", "email", "password", "role"];
    for (const f of required) {
      if (!body[f]) {
        return NextResponse.json({ error: `Missing field: ${f}` }, { status: 400 });
      }
    }

    // Check email uniqueness
    const { data: existing } = await supabase
      .from("staff")
      .select("id")
      .eq("email", body.email)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const { data: authUser, error } = await supabase.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        role: body.role,
        first_name: body.firstName,
        last_name: body.lastName,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase.from("staff").upsert({
      id: authUser.user.id,
      first_name: body.firstName,
      last_name: body.lastName,
      email: body.email,
      role: body.role,
      is_active: true,
    });

    await logAudit({
      userId: requestingUserId,
      action: "staff_create",
      tableName: "staff",
      recordId: authUser.user.id,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true, staff_id: authUser.user.id });
  }

  // ── Update staff details ──────────────────────────────────────────────────
  if (body.action === "update") {
    const { id, firstName, lastName, email, role } = body;
    if (!id || !firstName || !lastName || !email || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check email uniqueness (exclude current staff)
    const { data: dup } = await supabase
      .from("staff")
      .select("id")
      .eq("email", email)
      .neq("id", id)
      .maybeSingle();
    if (dup) {
      return NextResponse.json(
        { error: "Email already in use by another staff member" },
        { status: 409 }
      );
    }

    const { error } = await supabase
      .from("staff")
      .update({
        first_name: firstName,
        last_name: lastName,
        email,
        role,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: "Update failed" }, { status: 500 });
    }

    await logAudit({
      userId: requestingUserId,
      action: "staff_update",
      tableName: "staff",
      recordId: id,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true });
  }

  // ── Toggle active (deactivate / activate) ─────────────────────────────────
  if (body.action === "toggle_active") {
    const { id } = body;
    if (!id) {
      return NextResponse.json({ error: "Missing staff id" }, { status: 400 });
    }

    // Prevent admin from deactivating their own account
    if (id === requestingUserId) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account" },
        { status: 400 }
      );
    }

    // Fetch current state, then flip
    const { data: current } = await supabase
      .from("staff")
      .select("is_active")
      .eq("id", id)
      .single();

    const newActive = !(current?.is_active ?? true);

    await supabase.from("staff").update({ is_active: newActive }).eq("id", id);

    await logAudit({
      userId: requestingUserId,
      action: "staff_toggle",
      tableName: "staff",
      recordId: id,
      ipAddress: ip,
    });

    return NextResponse.json({ success: true, is_active: newActive });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

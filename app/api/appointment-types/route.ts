import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";

/**
 * GET /api/appointment-types
 * - Public (no auth): returns only active types
 * - Staff (Authorization header present): returns all types (for admin management)
 */
export async function GET(request: Request) {
  const supabase = createAdminClient();

  // Check if staff auth header is present to decide whether to return inactive too
  const authHeader =
    request.headers.get("authorization") ||
    request.headers.get("cookie");
  const staffMode = !!authHeader;

  let query = supabase
    .from("appointment_types")
    .select("id, name, duration, description, is_active")
    .order("name");

  if (!staffMode) {
    query = query.eq("is_active", true) as typeof query;
  }

  const { data } = await query;
  return NextResponse.json({ success: true, types: data ?? [] });
}

/**
 * POST /api/appointment-types  — admin only
 * Actions: add, toggle, update
 */
export async function POST(request: Request) {
  const auth = await requireStaff(["admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const supabase = createAdminClient();

  // ── Add ──────────────────────────────────────────────────────────────────
  if (body.action === "add") {
    if (!body.name || !body.duration || Number(body.duration) < 1) {
      return NextResponse.json(
        { error: "name and duration (≥1) are required" },
        { status: 400 }
      );
    }
    const { data, error } = await supabase
      .from("appointment_types")
      .insert({
        name: body.name,
        duration: Number(body.duration),
        description: body.description ?? null,
        is_active: true,
      })
      .select("id")
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true, id: data.id });
  }

  // ── Toggle is_active ──────────────────────────────────────────────────────
  if (body.action === "toggle") {
    if (!body.id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const { data: current } = await supabase
      .from("appointment_types")
      .select("is_active")
      .eq("id", body.id)
      .single();

    const newActive = !(current?.is_active ?? true);
    await supabase
      .from("appointment_types")
      .update({ is_active: newActive })
      .eq("id", body.id);
    return NextResponse.json({ success: true, is_active: newActive });
  }

  // ── Update ────────────────────────────────────────────────────────────────
  if (body.action === "update") {
    if (!body.id || !body.name || !body.duration || Number(body.duration) < 1) {
      return NextResponse.json(
        { error: "id, name and duration (≥1) are required" },
        { status: 400 }
      );
    }
    const { error } = await supabase
      .from("appointment_types")
      .update({
        name: body.name,
        duration: Number(body.duration),
        description: body.description ?? null,
      })
      .eq("id", body.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

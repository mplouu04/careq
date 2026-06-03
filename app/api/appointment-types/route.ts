import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { sanitize } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/appointment-types
 * - Public (no auth): returns only active types
 * - Staff (valid session): returns all types including inactive (for admin management)
 */
export async function GET() {
  const supabase = createAdminClient();

  const staffAuth = await requireStaff();
  const staffMode = !("error" in staffAuth);

  let query = supabase
    .from("appointment_types")
    .select("id, name, duration, description, is_active")
    .order("name");

  if (!staffMode) {
    query = query.eq("is_active", true) as typeof query;
  }

  const { data } = await query;
  const cacheHeader = staffMode
    ? { "Cache-Control": "no-store" }
    : { "Cache-Control": "s-maxage=60, stale-while-revalidate=300" };
  return NextResponse.json({ success: true, types: data ?? [] }, { headers: cacheHeader });
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let body: Record<string, any>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const supabase = createAdminClient();

  // ── Add ──────────────────────────────────────────────────────────────────
  if (body.action === "add") {
    const name = sanitize(body.name, 100);
    if (!name || !body.duration || Number(body.duration) < 1) {
      return NextResponse.json(
        { error: "name and duration (≥1) are required" },
        { status: 400 }
      );
    }
    const { data, error } = await supabase
      .from("appointment_types")
      .insert({
        name,
        duration: Number(body.duration),
        description: sanitize(body.description, 500) || null,
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
    const updName = sanitize(body.name, 100);
    if (!body.id || !updName || !body.duration || Number(body.duration) < 1) {
      return NextResponse.json(
        { error: "id, name and duration (≥1) are required" },
        { status: 400 }
      );
    }
    const { error } = await supabase
      .from("appointment_types")
      .update({
        name: updName,
        duration: Number(body.duration),
        description: sanitize(body.description, 500) || null,
      })
      .eq("id", body.id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

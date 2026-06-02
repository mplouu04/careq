import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";

export async function GET() {
  const auth = await requireStaff(["admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("display_settings")
    .select("id, display_name, location, show_wait_time, show_priority, theme_color, is_active")
    .order("id");
  return NextResponse.json({ success: true, screens: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireStaff(["admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const supabase = createAdminClient();

  // ── Add ──────────────────────────────────────────────────────────────────
  if (body.action === "add") {
    if (!body.display_name || !body.location) {
      return NextResponse.json(
        { error: "display_name and location are required" },
        { status: 400 }
      );
    }
    const { data, error } = await supabase
      .from("display_settings")
      .insert({
        display_name: body.display_name,
        location: body.location,
        show_wait_time: body.show_wait_time ?? true,
        show_priority: body.show_priority ?? true,
        theme_color: body.theme_color ?? "#0d6efd",
        is_active: true,
      })
      .select("id")
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, id: data.id });
  }

  // ── Toggle is_active ──────────────────────────────────────────────────────
  if (body.action === "toggle") {
    if (!body.id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    const { data: current } = await supabase
      .from("display_settings")
      .select("is_active")
      .eq("id", body.id)
      .single();

    const newActive = !(current?.is_active ?? true);
    await supabase
      .from("display_settings")
      .update({ is_active: newActive })
      .eq("id", body.id);
    return NextResponse.json({ success: true, is_active: newActive });
  }

  // ── Update ────────────────────────────────────────────────────────────────
  if (body.action === "update") {
    if (!body.id || !body.display_name || !body.location) {
      return NextResponse.json(
        { error: "id, display_name and location are required" },
        { status: 400 }
      );
    }
    const { error } = await supabase
      .from("display_settings")
      .update({
        display_name: body.display_name,
        location: body.location,
        show_wait_time: body.show_wait_time ?? true,
        show_priority: body.show_priority ?? true,
        theme_color: body.theme_color ?? "#0d6efd",
        is_active: body.is_active ?? true,
      })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  // ── Delete (hard) ─────────────────────────────────────────────────────────
  if (body.action === "delete") {
    if (!body.id) {
      return NextResponse.json({ error: "Missing id" }, { status: 400 });
    }
    await supabase.from("display_settings").delete().eq("id", body.id);
    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

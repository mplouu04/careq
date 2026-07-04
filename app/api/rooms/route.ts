import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { sanitize } from "@/lib/utils";

export const dynamic = "force-dynamic";

/**
 * GET /api/rooms
 * - Public (no auth): active rooms only
 * - Staff with ?all=1: all rooms including inactive
 */
export async function GET(request: Request) {
  const supabase = createAdminClient();
  const wantAll = new URL(request.url).searchParams.get("all") === "1";

  if (wantAll) {
    const auth = await requireStaff();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const { data } = await supabase
      .from("rooms")
      .select("id, name, description, is_active")
      .order("name");
    return NextResponse.json(
      { success: true, rooms: data ?? [] },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  }

  const { data } = await supabase
    .from("rooms")
    .select("id, name, description")
    .eq("is_active", true)
    .order("name");
  return NextResponse.json(
    { success: true, rooms: data ?? [] },
    { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } }
  );
}

/** POST /api/rooms — admin create or update room */
export async function POST(request: Request) {
  const auth = await requireStaff(["admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const supabase = createAdminClient();

  if (body.action === "update" && body.id) {
    const name = sanitize(String(body.name ?? ""), 100);
    const description = body.description != null ? sanitize(String(body.description), 500) : null;
    const { error } = await supabase
      .from("rooms")
      .update({
        name,
        description,
        is_active: body.is_active ?? true,
      })
      .eq("id", body.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json(
      { success: true },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  if (!body.name) {
    return NextResponse.json({ error: "Room name is required" }, { status: 400 });
  }

  const name = sanitize(String(body.name), 100);
  const description = body.description != null ? sanitize(String(body.description), 500) : null;

  const { data, error } = await supabase
    .from("rooms")
    .insert({
      name,
      description,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { success: true, id: data.id },
    { headers: { "Cache-Control": "no-store" } }
  );
}

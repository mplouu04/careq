import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** GET /api/rooms — active rooms for public; staff/admin sees all with is_active flag */
export async function GET() {
  const supabase = createAdminClient();
  const auth = await requireStaff();

  if ("error" in auth) {
    const { data } = await supabase
      .from("rooms")
      .select("id, name, description")
      .eq("is_active", true)
      .order("name");
    return NextResponse.json(
      { success: true, rooms: data ?? [] },
      { headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=240" } }
    );
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

/** POST /api/rooms — admin create or update room */
export async function POST(request: Request) {
  const auth = await requireStaff(["admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json().catch(() => ({}));
  const supabase = createAdminClient();

  if (body.action === "update" && body.id) {
    const { error } = await supabase
      .from("rooms")
      .update({
        name: body.name,
        description: body.description ?? null,
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

  const { data, error } = await supabase
    .from("rooms")
    .insert({
      name: body.name,
      description: body.description ?? null,
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

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";

export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("appointment_types")
    .select("*")
    .eq("is_active", true)
    .order("name");
  return NextResponse.json({ success: true, types: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireStaff(["admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const body = await request.json();
  const supabase = createAdminClient();

  if (body.action === "delete") {
    await supabase.from("appointment_types").update({ is_active: false }).eq("id", body.id);
    return NextResponse.json({ success: true });
  }

  if (body.id) {
    const { error } = await supabase
      .from("appointment_types")
      .update({
        name: body.name,
        duration: body.duration,
        description: body.description,
      })
      .eq("id", body.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase.from("appointment_types").insert({
    name: body.name,
    duration: body.duration,
    description: body.description,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

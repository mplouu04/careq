import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";

export async function GET() {
  const auth = await requireStaff(["admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const supabase = createAdminClient();
  const { data } = await supabase.from("display_settings").select("*").order("id");
  return NextResponse.json({ success: true, settings: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireStaff(["admin"]);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await request.json();
  const supabase = createAdminClient();

  if (body.action === "delete") {
    await supabase.from("display_settings").delete().eq("id", body.id);
    return NextResponse.json({ success: true });
  }

  if (body.id) {
    await supabase
      .from("display_settings")
      .update({
        display_name: body.displayName,
        location: body.location,
        show_wait_time: body.showWaitTime,
        show_priority: body.showPriority,
        theme_color: body.themeColor,
        is_active: body.isActive ?? true,
      })
      .eq("id", body.id);
    return NextResponse.json({ success: true });
  }

  await supabase.from("display_settings").insert({
    display_name: body.displayName,
    location: body.location,
    show_wait_time: body.showWaitTime ?? true,
    show_priority: body.showPriority ?? true,
    theme_color: body.themeColor ?? "#0d6efd",
  });

  return NextResponse.json({ success: true });
}

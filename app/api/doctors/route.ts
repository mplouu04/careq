import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("staff")
    .select("id, first_name, last_name")
    .eq("role", "doctor")
    .neq("is_active", false)
    .order("last_name");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true, doctors: data ?? [] }, {
    headers: { "Cache-Control": "no-store" },
  });
}

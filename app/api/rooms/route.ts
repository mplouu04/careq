import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("rooms")
    .select("*")
    .eq("is_active", true)
    .order("name");
  return NextResponse.json({ success: true, rooms: data ?? [] });
}

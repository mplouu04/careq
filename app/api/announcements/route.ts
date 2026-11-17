import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api/with-auth";

export const dynamic = "force-dynamic";

export const GET = withRateLimit(
  "announcements_public",
  async () => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("announcements")
      .select("id, title, body, published_at")
      .eq("is_active", true)
      .order("published_at", { ascending: false })
      .limit(5);

    if (error) {
      return NextResponse.json({ error: "Failed to load announcements" }, { status: 500 });
    }
    return NextResponse.json({ success: true, announcements: data ?? [] });
  },
  { max: 60, windowSeconds: 60, failClosed: true }
);
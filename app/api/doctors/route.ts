import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api/with-auth";
import { agentDebugLog } from "@/lib/debug-agent-log";

export const dynamic = "force-dynamic";

export const GET = withRateLimit(
  "doctors_list",
  async () => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("staff")
      .select("id, first_name, last_name, is_active")
      .eq("role", "doctor")
      .order("is_active", { ascending: false })
      .order("last_name");

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    // #region agent log
    agentDebugLog("C", "doctors/route.ts:GET", "doctors API payload", {
      doctors: (data ?? []).map((d) => ({
        last: d.last_name,
        is_active: d.is_active,
        idSuffix: String(d.id).slice(-6),
      })),
    });
    // #endregion
    return NextResponse.json(
      { success: true, doctors: data ?? [] },
      {
        headers: {
          "Cache-Control": "private, no-store",
          "CDN-Cache-Control": "no-store",
          "Vercel-CDN-Cache-Control": "no-store",
        },
      }
    );
  },
  { max: 60, windowSeconds: 60, failClosed: true }
);

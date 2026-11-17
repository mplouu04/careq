import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/api/with-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClinicDayStartIso, getClinicTodayYmd } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export const GET = withStaffAuth(async () => {
  const supabase = createAdminClient();
  const today = getClinicTodayYmd();
  const dayStart = getClinicDayStartIso(today);

  const { data, error } = await supabase
    .from("queue")
    .select(
      `id, queue_number, status, updated_at,
       checkins(reference_number, patients(first_name, last_name))`
    )
    .in("status", ["completed", "cancelled", "no_show"])
    .gte("updated_at", dayStart)
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: "Failed to load queue history" }, { status: 500 });
  }
  return NextResponse.json({ success: true, history: data ?? [] });
}, ["admin", "receptionist", "nurse"]);
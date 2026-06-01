import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { format } from "date-fns";

export async function GET() {
  const supabase = createAdminClient();
  const today = format(new Date(), "yyyy-MM-dd");

  const { data } = await supabase
    .from("queue")
    .select(
      `id, queue_number, status, room_id,
       checkins(patients(first_name, last_name))`
    )
    .gte("created_at", `${today}T00:00:00`)
    .in("status", ["waiting", "in_progress"])
    .order("created_at", { ascending: true });

  const items = data ?? [];
  return NextResponse.json({
    success: true,
    nowServing: items.filter((q) => q.status === "in_progress"),
    waiting: items.filter((q) => q.status === "waiting"),
  });
}

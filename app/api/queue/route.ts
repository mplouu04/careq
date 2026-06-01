import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/auth";
import { format } from "date-fns";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ref = searchParams.get("ref");
  const today = format(new Date(), "yyyy-MM-dd");
  const supabase = createAdminClient();

  let query = supabase
    .from("queue")
    .select(
      `id, queue_number, status, priority, called_at, room_id, skip_count, created_at,
       checkins!inner(
         checkin_id, reference_number, reason, type_id,
         patients(first_name, last_name),
         appointment_types(name),
         staff:doctor_id(first_name, last_name)
       )`
    )
    .gte("created_at", `${today}T00:00:00`)
    .lte("created_at", `${today}T23:59:59`);

  if (ref) {
    const { data: byNumber } = await supabase
      .from("queue")
      .select(
        `id, queue_number, status, priority, called_at, room_id, skip_count, created_at,
         checkins!inner(
           checkin_id, reference_number, reason, type_id,
           patients(first_name, last_name),
           appointment_types(name),
           staff:doctor_id(first_name, last_name)
         )`
      )
      .or(`queue_number.eq.${ref},checkins.reference_number.eq.${ref}`)
      .gte("created_at", `${today}T00:00:00`)
      .maybeSingle();

    if (byNumber) {
      const { data: allWaiting } = await supabase
        .from("queue")
        .select("id, queue_number, status")
        .eq("status", "waiting")
        .gte("created_at", `${today}T00:00:00`)
        .order("created_at", { ascending: true });

      const waiting = allWaiting ?? [];
      const position =
        waiting.findIndex((q) => q.id === byNumber.id) + 1;
      return NextResponse.json({
        success: true,
        queue: byNumber,
        position: byNumber.status === "waiting" && position > 0 ? position : null,
        waitingCount: waiting.length,
      });
    }
    return NextResponse.json({ success: false, error: "Not found" }, { status: 404 });
  } else {
    const auth = await requireStaff();
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    query = query.in("status", ["waiting", "called", "in_progress"]);
  }

  const { data, error } = await query.order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, queue: data ?? [] });
}

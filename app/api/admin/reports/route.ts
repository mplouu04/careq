import { NextResponse } from "next/server";
import { withStaffAuth } from "@/lib/api/with-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHECKIN_TYPE } from "@/lib/constants";
import { getClinicTodayYmd, getClinicDayStartIso } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export const GET = withStaffAuth(async (request: Request) => {
  const range = new URL(request.url).searchParams.get("range") ?? "daily";
  const supabase = createAdminClient();
  const today = getClinicTodayYmd();
  const todayStart = getClinicDayStartIso(today);

  const monthStart = `${today.slice(0, 7)}-01T00:00:00`;

  const fromIso = range === "monthly" ? monthStart : todayStart;

  const [
    patientsRes,
    apptPending,
    apptCheckedIn,
    apptCancelled,
    apptCompleted,
    queueDone,
  ] = await Promise.all([
    supabase
      .from("patients")
      .select("id", { count: "exact", head: true })
      .gte("created_at", fromIso),
    supabase
      .from("checkins")
      .select("checkin_id", { count: "exact", head: true })
      .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
      .eq("status", "pending")
      .gte("appointment_date", fromIso),
    supabase
      .from("checkins")
      .select("checkin_id", { count: "exact", head: true })
      .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
      .eq("status", "checked_in")
      .gte("appointment_date", fromIso),
    supabase
      .from("checkins")
      .select("checkin_id", { count: "exact", head: true })
      .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
      .eq("status", "cancelled")
      .gte("appointment_date", fromIso),
    supabase
      .from("checkins")
      .select("checkin_id", { count: "exact", head: true })
      .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
      .eq("status", "completed")
      .gte("appointment_date", fromIso),
    supabase
      .from("queue")
      .select("id", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("updated_at", todayStart),
  ]);

  return NextResponse.json({
    success: true,
    range,
    patients_registered: patientsRes.count ?? 0,
    appointments: {
      pending: apptPending.count ?? 0,
      checked_in: apptCheckedIn.count ?? 0,
      cancelled: apptCancelled.count ?? 0,
      completed: apptCompleted.count ?? 0,
    },
    queue_completed_today: queueDone.count ?? 0,
  });
}, ["admin"]);
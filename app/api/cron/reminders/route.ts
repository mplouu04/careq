import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHECKIN_TYPE } from "@/lib/constants";
import { addDays, format } from "date-fns";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  // Fail closed: if CRON_SECRET is not configured, block all access
  if (!cronSecret) {
    return NextResponse.json({ error: "Cron not configured" }, { status: 503 });
  }
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

  const { data: appointments } = await supabase
    .from("checkins")
    .select(
      `reference_number, scheduled_time, appointment_date,
       patients(first_name, last_name, email, phone),
       staff:doctor_id(first_name, last_name)`
    )
    .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
    .eq("status", "pending")
    .gte("appointment_date", `${tomorrow}T00:00:00`)
    .lte("appointment_date", `${tomorrow}T23:59:59`);

  const reminders = (appointments ?? []).filter((a) => {
    const raw = a.patients as unknown;
    const patient = (Array.isArray(raw) ? raw[0] : raw) as { email?: string | null };
    return patient?.email;
  });

  // Log reminders — wire to Resend/SendGrid in production
  console.log(`[CAREQ Cron] ${reminders.length} appointment reminders for ${tomorrow}`);

  return NextResponse.json({
    success: true,
    date: tomorrow,
    count: reminders.length,
    message: "Reminders logged. Configure an email provider for production delivery.",
  });
}

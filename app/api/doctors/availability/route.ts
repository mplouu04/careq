import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getDoctorAvailableSlots } from "@/lib/slots-availability";

export const dynamic = "force-dynamic";

/**
 * GET /api/doctors/availability?date=YYYY-MM-DD&doctorId=&durationMinutes=30
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const doctorId = searchParams.get("doctorId")?.trim() ?? "";
  const date = searchParams.get("date");
  const durationMinutes = parseInt(searchParams.get("durationMinutes") ?? "30", 10) || 30;

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date is required (YYYY-MM-DD)" },
      { status: 400 }
    );
  }

  if (!doctorId) {
    const supabase = createAdminClient();
    const { data: doctors } = await supabase
      .from("staff")
      .select("id")
      .eq("role", "doctor")
      .eq("is_active", true);

    const allSlots = new Set<string>();
    for (const doc of doctors ?? []) {
      const slots = await getDoctorAvailableSlots(doc.id, date, durationMinutes);
      slots.forEach((s) => allSlots.add(s));
    }
    const sorted = Array.from(allSlots).sort();
    return NextResponse.json({ success: true, available_slots: sorted });
  }

  const slots = await getDoctorAvailableSlots(doctorId, date, durationMinutes);
  return NextResponse.json({
    success: true,
    available_slots: slots,
    slots,
    no_schedule: slots.length === 0,
  });
}

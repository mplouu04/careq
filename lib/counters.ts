import { createAdminClient } from "@/lib/supabase/admin";
import { formatInTimeZone } from "date-fns-tz";
import { TIMEZONE } from "@/lib/constants";
import { format } from "date-fns";

export type CounterKey = "APPT" | "WALK" | "APT_REF";

export async function nextCounter(
  counterKey: CounterKey,
  date?: Date
): Promise<number> {
  const supabase = createAdminClient();
  const counterDate = formatInTimeZone(date ?? new Date(), TIMEZONE, "yyyy-MM-dd");

  const { data, error } = await supabase.rpc("next_counter", {
    p_date: counterDate,
    p_key: counterKey,
  });

  if (error) throw new Error(`Counter failed: ${error.message}`);
  return data as number;
}

export async function nextQueueNumber(prefix: "APPT" | "WALK"): Promise<string> {
  const n = await nextCounter(prefix);
  return `${prefix}-${n}`;
}

export async function nextAppointmentReference(appointmentDate: string): Promise<string> {
  const n = await nextCounter("APT_REF");
  return `APT${format(new Date(appointmentDate), "yyyyMMdd")}${n}`;
}

export async function checkinToQueue(
  checkinId: number,
  prefix: "APPT" | "WALK"
): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("checkin_to_queue", {
    p_checkin_id: checkinId,
    p_prefix: prefix,
  });

  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("checkin_not_found")) {
      throw new CheckinError("Appointment not found", 404);
    }
    if (msg.includes("checkin_terminal")) {
      throw new CheckinError(
        `Cannot check in: appointment is ${msg.split(":")[1] ?? "unavailable"}.`,
        409
      );
    }
    if (msg.includes("already_in_queue")) {
      throw new CheckinError("Patient is already in the queue.", 409);
    }
    if (error.code === "23505") {
      return retryCheckinToQueue(checkinId, prefix);
    }
    throw new CheckinError(error.message, 500);
  }

  return data as string;
}

async function retryCheckinToQueue(
  checkinId: number,
  prefix: "APPT" | "WALK"
): Promise<string> {
  return checkinToQueue(checkinId, prefix);
}

export class CheckinError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "CheckinError";
  }
}

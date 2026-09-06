import { formatInTimeZone } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/admin";
import { CHECKIN_TYPE, TIMEZONE } from "@/lib/constants";
import { addClinicDays, getClinicTodayYmd } from "@/lib/datetime";
import { getEnvSafe } from "@/lib/env";
import { sendAppointmentReminder } from "@/lib/email";
import { logInfo, logWarn, captureException } from "@/lib/observability";

type ReminderRow = {
  checkin_id: number;
  reference_number: string;
  scheduled_time: string | null;
  appointment_date: string;
  patients: unknown;
  staff: unknown;
};

function relationOne<T>(raw: unknown): T | null {
  if (!raw) return null;
  return (Array.isArray(raw) ? raw[0] : raw) as T;
}

async function persistReminderFailure(row: {
  checkin_id: number;
  reference_number: string;
  email: string | null;
  error: string;
  retryable: boolean;
}) {
  const supabase = createAdminClient();
  const { error } = await supabase.from("reminder_failures").insert({
    checkin_id: row.checkin_id,
    reference_number: row.reference_number,
    recipient_email: row.email,
    error_message: row.error.slice(0, 500),
    retryable: row.retryable,
  });
  if (error) {
    logWarn("reminder_failure_persist_failed", {
      reference: row.reference_number,
      error: error.message,
    });
  }
}

export async function sendTomorrowAppointmentReminders() {
  const supabase = createAdminClient();
  const tomorrow = addClinicDays(getClinicTodayYmd(), 1);
  const env = getEnvSafe();
  const clinicName = env?.CLINIC_NAME ?? "Your Clinic";
  const clinicAddress = env?.CLINIC_ADDRESS ?? "See clinic website for directions";
  const appUrl = env?.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const { data: appointments, error } = await supabase
    .from("checkins")
    .select(
      `checkin_id, reference_number, scheduled_time, appointment_date,
       patients(first_name, last_name, email),
       staff:doctor_id(first_name, last_name)`
    )
    .eq("type_id", CHECKIN_TYPE.APPOINTMENT)
    .eq("status", "pending")
    .is("reminder_sent_at", null)
    .gte("appointment_date", `${tomorrow}T00:00:00`)
    .lte("appointment_date", `${tomorrow}T23:59:59`);

  if (error) {
    throw new Error(`Failed to load appointments: ${error.message}`);
  }

  const rows = (appointments ?? []) as ReminderRow[];
  let sent = 0;
  let skipped = 0;
  let failed = 0;
  const deadLetter: { reference: string; error: string }[] = [];

  const concurrency = 5;
  for (let i = 0; i < rows.length; i += concurrency) {
    const batch = rows.slice(i, i + concurrency);
    await Promise.all(
      batch.map(async (row) => {
        const patient = relationOne<{
          first_name: string;
          last_name: string;
          email: string | null;
        }>(row.patients);

        if (!patient?.email) {
          skipped++;
          return;
        }

        const doctor = relationOne<{ first_name: string; last_name: string }>(row.staff);
        const doctorName = doctor
          ? `Dr. ${doctor.first_name} ${doctor.last_name}`
          : "Your doctor";

        const apptInstant = row.scheduled_time ?? row.appointment_date;
        const appointmentDate = formatInTimeZone(apptInstant, TIMEZONE, "EEEE, MMMM d, yyyy");
        const appointmentTime = formatInTimeZone(apptInstant, TIMEZONE, "h:mm a");

        const result = await sendAppointmentReminder({
          to: patient.email,
          patientName: `${patient.first_name} ${patient.last_name}`,
          referenceNumber: row.reference_number,
          appointmentDate,
          appointmentTime,
          doctorName,
          clinicName,
          clinicAddress,
          statusUrl: `${appUrl}/status/${encodeURIComponent(row.reference_number)}`,
        });

        if (result.ok) {
          const { error: updateError } = await supabase
            .from("checkins")
            .update({ reminder_sent_at: new Date().toISOString() })
            .eq("checkin_id", row.checkin_id)
            .is("reminder_sent_at", null);

          if (updateError) {
            logWarn("reminder_sent_at_update_failed", {
              checkin_id: row.checkin_id,
              reference: row.reference_number,
              error: updateError.message,
            });
          }
          sent++;
        } else if (result.retryable) {
          failed++;
          deadLetter.push({ reference: row.reference_number, error: result.error });
          await persistReminderFailure({
            checkin_id: row.checkin_id,
            reference_number: row.reference_number,
            email: patient.email,
            error: result.error,
            retryable: true,
          });
        } else {
          skipped++;
        }
      })
    );
  }

  logInfo("appointment_reminders", {
    date: tomorrow,
    eligible: rows.length,
    sent,
    skipped,
    failed,
    dead_letter_count: deadLetter.length,
  });

  if (failed > 0) {
    captureException(new Error("Reminder cron partial failure"), {
      route: "/api/cron/reminders",
      failed,
      dead_letter_count: deadLetter.length,
    });
  }

  return { date: tomorrow, eligible: rows.length, sent, skipped, failed, deadLetter };
}

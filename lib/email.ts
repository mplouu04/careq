import { getEnvSafe } from "@/lib/env";
import { captureException, logWarn } from "@/lib/observability";
import { escapeHtml } from "@/lib/html";

export type AppointmentReminderPayload = {
  to: string;
  patientName: string;
  referenceNumber: string;
  appointmentDate: string;
  appointmentTime: string;
  doctorName: string;
  clinicName: string;
  clinicAddress: string;
  statusUrl: string;
};

export type SendEmailResult =
  | { ok: true; id?: string }
  | { ok: false; error: string; retryable: boolean };

function buildReminderHtml(payload: AppointmentReminderPayload): string {
  const name = escapeHtml(payload.patientName);
  const clinic = escapeHtml(payload.clinicName);
  const ref = escapeHtml(payload.referenceNumber);
  const date = escapeHtml(payload.appointmentDate);
  const time = escapeHtml(payload.appointmentTime);
  const doctor = escapeHtml(payload.doctorName);
  const address = escapeHtml(payload.clinicAddress);
  const statusUrl = escapeHtml(payload.statusUrl);
  return `
    <p>Hi ${name},</p>
    <p>This is a reminder that you have an appointment tomorrow at <strong>${clinic}</strong>.</p>
    <ul>
      <li><strong>Reference:</strong> ${ref}</li>
      <li><strong>Date:</strong> ${date}</li>
      <li><strong>Time:</strong> ${time}</li>
      <li><strong>Doctor:</strong> ${doctor}</li>
      <li><strong>Location:</strong> ${address}</li>
    </ul>
    <p>Track your visit status: <a href="${statusUrl}">${statusUrl}</a></p>
    <p>If you need to cancel, use your appointment reference and registered phone number on the clinic portal.</p>
  `.trim();
}

/** Sends an appointment reminder via Resend. Returns structured result for idempotent cron handling. */
export async function sendAppointmentReminder(
  payload: AppointmentReminderPayload
): Promise<SendEmailResult> {
  const env = getEnvSafe();
  const apiKey = env?.RESEND_API_KEY;
  const from = env?.RESEND_FROM_EMAIL;

  if (!apiKey || !from) {
    logWarn("email_skipped", {
      reason: "RESEND_API_KEY or RESEND_FROM_EMAIL not configured",
      reference: payload.referenceNumber,
    });
    return { ok: false, error: "Email provider not configured", retryable: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: payload.to,
        subject: `Appointment reminder — ${payload.appointmentDate} at ${payload.clinicName}`,
        html: buildReminderHtml(payload),
      }),
    });

    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };

    if (!res.ok) {
      const message = body.message ?? `Resend HTTP ${res.status}`;
      logWarn("email_send_failed", {
        reference: payload.referenceNumber,
        to: payload.to,
        status: res.status,
        message,
      });
      return { ok: false, error: message, retryable: res.status >= 500 || res.status === 429 };
    }

    return { ok: true, id: body.id };
  } catch (err) {
    captureException(err, {
      context: "sendAppointmentReminder",
      reference: payload.referenceNumber,
    });
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Send failed",
      retryable: true,
    };
  }
}

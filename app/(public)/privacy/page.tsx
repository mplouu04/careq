import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { getClinicPublicInfo } from "@/lib/clinic-public";

export const metadata: Metadata = {
  title: "Privacy Notice | CAREQ",
  description: "How CAREQ and your clinic process personal data for registration, booking, and queue check-in.",
};

export default function PrivacyPage() {
  const clinic = getClinicPublicInfo();

  return (
    <LegalPageShell title="Privacy Notice" updated="8 September 2026">
      <p>
        This Privacy Notice explains how <strong className="text-on-surface">{clinic.name}</strong>{" "}
        (“we”, “us”, the personal information controller for clinic patient data) and the CareQ queue
        system process personal data when you register, book, check in, or track your visit.
      </p>

      <h2>1. Who we are</h2>
      <ul>
        <li>
          <strong className="text-on-surface">Clinic / PIC:</strong> {clinic.name}
        </li>
        {clinic.address ? (
          <li>
            <strong className="text-on-surface">Address:</strong> {clinic.address}
          </li>
        ) : (
          <li>
            <strong className="text-on-surface">Address:</strong> Ask the front desk or set{" "}
            <code className="text-on-surface">CLINIC_ADDRESS</code> in deployment config.
          </li>
        )}
        {clinic.phone ? (
          <li>
            <strong className="text-on-surface">Phone:</strong> {clinic.phone}
          </li>
        ) : null}
        <li>
          <strong className="text-on-surface">Privacy / DPO contact:</strong>{" "}
          {clinic.privacyEmail ? (
            <a href={`mailto:${clinic.privacyEmail}`}>{clinic.privacyEmail}</a>
          ) : (
            <>
              Contact the clinic front desk, or configure{" "}
              <code className="text-on-surface">CLINIC_PRIVACY_EMAIL</code>.
            </>
          )}
        </li>
        <li>
          <strong className="text-on-surface">Hours:</strong> {clinic.hoursLabel} (clinic timezone
          Asia/Manila unless configured otherwise)
        </li>
      </ul>

      <h2>2. Personal data we collect</h2>
      <p>Depending on the flow, we may process:</p>
      <ul>
        <li>Identity and contact: name, date of birth, gender, phone, email, address</li>
        <li>Visit details: appointment type, doctor preference, date/time, reason for visit</li>
        <li>Queue data: check-in reference, queue number, status, room assignment</li>
        <li>Technical data: IP address (rate limits / audit), browser push subscription (if you opt in)</li>
        <li>Verification: short-lived email codes and identity verify tokens</li>
      </ul>
      <p>
        Age and health-related visit information may be treated as{" "}
        <strong className="text-on-surface">sensitive personal information</strong> under the Philippine
        Data Privacy Act of 2012 (RA 10173). We only collect what is needed to run clinic visits and
        appointments.
      </p>

      <h2>3. Purposes and basis</h2>
      <ul>
        <li>Register you as a patient and match returning patients</li>
        <li>Book, confirm, cancel, and check in appointments</li>
        <li>Manage the live queue and notify you when it is your turn (including optional Web Push)</li>
        <li>Send transactional email (verification codes and appointment reminders)—not marketing mail</li>
        <li>Security: rate limiting, audit logs, abuse prevention</li>
      </ul>
      <p>
        Processing is for providing clinic queue and appointment services. Where consent is collected in
        the app, it supports transparency for these purposes. Your clinic’s counsel should confirm the
        appropriate lawful criteria under Sections 12 and 13 of the DPA (consent is not always the sole
        or best basis for healthcare-related processing).
      </p>

      <h2>4. Recipients and processors</h2>
      <p>
        Data is processed using service providers that host and operate CareQ. They act as personal
        information processors on our instructions:
      </p>
      <ul>
        <li>
          <strong className="text-on-surface">Supabase</strong> — database, authentication (staff), and
          realtime updates
        </li>
        <li>
          <strong className="text-on-surface">Vercel</strong> — application hosting and scheduled jobs
        </li>
        <li>
          <strong className="text-on-surface">Resend</strong> — transactional email (codes and reminders),
          when email is configured
        </li>
        <li>
          <strong className="text-on-surface">Sentry</strong> — optional error monitoring (if enabled);
          we attempt to redact known personal fields from logs
        </li>
        <li>
          <strong className="text-on-surface">Web Push providers</strong> — only if you enable turn
          notifications in the browser
        </li>
      </ul>
      <p>
        These providers may process data in data centers outside the Philippines. Ask the clinic which
        regions are configured for your deployment. We do not sell your personal data.
      </p>

      <h2>5. Cookies and local storage</h2>
      <ul>
        <li>
          <strong className="text-on-surface">Essential:</strong> staff login session cookies (Supabase
          Auth) for clinic staff dashboards
        </li>
        <li>
          <strong className="text-on-surface">Session storage:</strong> short-lived patient verify token
          after identity check (not a tracking cookie)
        </li>
        <li>
          We do not use advertising pixels or third-party marketing analytics on CareQ pages. If error
          monitoring (Sentry) is enabled, it may load for reliability purposes as described above.
        </li>
      </ul>

      <h2>6. Retention</h2>
      <ul>
        <li>
          Email verification codes and proof tokens: minutes (typically 10–15), then purged
        </li>
        <li>Patient verify sessions: short-lived (typically about 15 minutes), single-use</li>
        <li>
          Operational logs (rate limits, audit entries): retained for a configurable period (default
          multi-year operational retention for security/accountability—not a substitute for a clinic
          medical-records retention schedule)
        </li>
        <li>
          Patient, appointment, and check-in records: kept while needed for clinic operations and
          applicable Philippine medical/legal retention rules—ask the clinic for its records policy
        </li>
      </ul>

      <h2>7. Your rights</h2>
      <p>Under the DPA, you may have rights to be informed, access, object, erasure or blocking, damages, and to file a complaint with the National Privacy Commission (NPC). To exercise rights regarding your clinic record, contact the privacy email or front desk above. You may also contact the NPC:{" "}
        <a href="https://privacy.gov.ph" rel="noopener noreferrer" target="_blank">
          privacy.gov.ph
        </a>
        .
      </p>

      <h2>8. Security</h2>
      <p>
        We use HTTPS, access controls for staff, rate limiting on public forms, and hashed email
        verification codes. No method of transmission or storage is perfectly secure.
      </p>

      <h2>9. Children</h2>
      <p>
        Online self-registration currently requires patients to be at least 18 years old. For minors,
        contact the clinic front desk for an appropriate registration path.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this notice when CareQ features or clinic practices change. The “Last updated”
        date at the top will change when we do.
      </p>
    </LegalPageShell>
  );
}

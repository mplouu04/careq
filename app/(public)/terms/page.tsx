import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { getClinicPublicInfo } from "@/lib/clinic-public";

export const metadata: Metadata = {
  title: "Terms of Use | CAREQ",
  description: "Terms for using CAREQ clinic registration, booking, and queue check-in.",
};

export default function TermsPage() {
  const clinic = getClinicPublicInfo();

  return (
    <LegalPageShell title="Terms of Use" updated="8 September 2026">
      <p>
        These Terms of Use govern your use of the CareQ website and queue tools operated for{" "}
        <strong className="text-on-surface">{clinic.name}</strong>. By registering, booking,
        checking in, or using queue status, you agree to these terms.
      </p>

      <h2>1. Not medical advice / emergencies</h2>
      <p>
        CareQ is a <strong className="text-on-surface">queue and appointment coordination tool</strong>.
        It does not provide medical advice, diagnosis, or treatment. If you have a medical emergency,
        call local emergency services or go to the nearest emergency facility—do not rely on this
        website for urgent care.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        Online self-service registration is limited to users aged 18 or older. Provide accurate
        information. Misuse (impersonation, booking for others without authority, automated abuse)
        may result in blocked access.
      </p>

      <h2>3. Accounts and verification</h2>
      <ul>
        <li>You may need to verify email ownership and/or identity (date of birth and phone) before certain actions.</li>
        <li>Keep your phone and email up to date so the clinic can reach you about appointments.</li>
        <li>Staff accounts are for authorized clinic personnel only.</li>
      </ul>

      <h2>4. Appointments and cancellation</h2>
      <ul>
        <li>Booking depends on doctor schedules and available slots; a slot is not guaranteed until the system confirms it.</li>
        <li>
          You may cancel eligible appointments through{" "}
          <Link href="/my-appointments">My appointments</Link> using the phone number on file.
        </li>
        <li>
          Clinic-specific late / no-show policies may apply in person—ask the front desk. This site
          does not process payments or refunds online.
        </li>
      </ul>

      <h2>5. Queue and check-in</h2>
      <ul>
        <li>Queue numbers and wait estimates are approximate and can change.</li>
        <li>Arrive according to clinic instructions; missing your turn may require re-check-in.</li>
        <li>Optional browser push notifications require your permission and can be disabled in device settings.</li>
      </ul>

      <h2>6. Privacy</h2>
      <p>
        Personal data is processed as described in our{" "}
        <Link href="/privacy">Privacy Notice</Link>. Do not submit other people’s data unless you are
        authorized to do so.
      </p>

      <h2>7. Acceptable use</h2>
      <p>
        Do not attempt to disrupt the service, scrape personal data, bypass rate limits or
        verification, or use the system for unlawful purposes.
      </p>

      <h2>8. Availability and liability</h2>
      <p>
        We aim for reliable service but do not guarantee uninterrupted access. To the extent permitted
        by Philippine law, {clinic.name} and CareQ operators are not liable for indirect or
        consequential losses arising from queue delays, missed appointments due to connectivity issues,
        or reliance on estimated wait times. Nothing in these terms limits liability that cannot be
        limited by law.
      </p>

      <h2>9. Contact</h2>
      <ul>
        <li>{clinic.name}</li>
        {clinic.address ? <li>{clinic.address}</li> : null}
        {clinic.phone ? <li>Phone: {clinic.phone}</li> : null}
        {clinic.privacyEmail ? (
          <li>
            Privacy: <a href={`mailto:${clinic.privacyEmail}`}>{clinic.privacyEmail}</a>
          </li>
        ) : (
          <li>Privacy: contact the clinic front desk</li>
        )}
      </ul>

      <h2>10. Changes</h2>
      <p>
        We may update these terms as the product or clinic policies change. Continued use after an
        update constitutes acceptance of the revised terms.
      </p>
    </LegalPageShell>
  );
}

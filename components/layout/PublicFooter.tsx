import Link from "next/link";
import { getClinicPublicInfo } from "@/lib/clinic-public";

export function PublicFooter() {
  const year = new Date().getFullYear();
  const clinic = getClinicPublicInfo();

  return (
    <footer className="w-full py-6 px-margin-mobile md:px-margin-desktop border-t border-outline-variant bg-surface-container-lowest">
      <div className="max-w-careq mx-auto flex flex-col gap-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="space-y-1">
            <span className="text-label-md font-bold text-on-surface">{clinic.name}</span>
            <p className="text-body-sm text-on-surface-variant">
              © {year} CAREQ Queue Management System
            </p>
            {clinic.address ? (
              <p className="text-body-sm text-on-surface-variant">{clinic.address}</p>
            ) : null}
            <p className="text-body-sm text-on-surface-variant">
              {clinic.hoursLabel}
              {clinic.phone ? ` · ${clinic.phone}` : ""}
            </p>
            {clinic.privacyEmail ? (
              <p className="text-body-sm text-on-surface-variant">
                Privacy:{" "}
                <a className="text-primary hover:underline" href={`mailto:${clinic.privacyEmail}`}>
                  {clinic.privacyEmail}
                </a>
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link
              href="/privacy"
              className="text-body-sm text-on-surface-variant hover:text-primary transition-colors"
            >
              Privacy Notice
            </Link>
            <Link
              href="/terms"
              className="text-body-sm text-on-surface-variant hover:text-primary transition-colors"
            >
              Terms of Use
            </Link>
            <Link
              href="/status"
              className="text-body-sm text-on-surface-variant hover:text-primary transition-colors"
            >
              Live Updates
            </Link>
            <Link
              href="/visit"
              className="text-body-sm text-on-surface-variant hover:text-primary transition-colors"
            >
              Check in
            </Link>
          </div>
        </div>
        <p className="text-body-sm text-on-surface-variant">
          CareQ coordinates clinic visits and queues. It is not medical advice. For emergencies,
          contact local emergency services.
        </p>
      </div>
    </footer>
  );
}

import Link from "next/link";
import { CalendarPlus, MapPin, ClipboardList } from "lucide-react";
import { ClinicStatusBar } from "@/components/patient/ClinicStatusBar";
import { QueueTrackForm } from "@/components/patient/QueueTrackForm";
import { ClinicHelpStrip } from "@/components/patient/ClinicHelpStrip";
import { CareqPage } from "@/components/careq";
import { getClinicPublicInfo } from "@/lib/clinic-public";
import { cn } from "@/lib/utils";

const cardClass =
  "group flex flex-col rounded-2xl border border-outline-variant bg-surface-container-lowest p-6 min-h-[160px] hover:border-primary hover:shadow-md transition-all focus-within:ring-2 focus-within:ring-ring";

export function PatientHub() {
  const clinic = getClinicPublicInfo();

  return (
    <CareqPage className="py-8 md:py-12 space-y-8">
      <header className="space-y-2">
        <p className="text-label-md font-semibold uppercase tracking-wide text-primary">
          {clinic.name}
        </p>
        <h1 className="text-headline-lg font-bold text-on-surface tracking-tight">
          Welcome — what do you need?
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-xl">
          Book a visit, check in when you arrive, or see where you are in line. Large buttons,
          few steps.
        </p>
      </header>

      <ClinicStatusBar />

      <section
        className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-5 md:p-6 space-y-3"
        aria-labelledby="track-line-heading"
      >
        <h2 id="track-line-heading" className="text-headline-sm text-on-surface">
          Track my line
        </h2>
        <p className="text-body-md text-on-surface-variant">
          Enter the code from your check-in or booking confirmation.
        </p>
        <QueueTrackForm idPrefix="hub-track" />
      </section>

      <section aria-labelledby="hub-actions-heading" className="space-y-4">
        <h2 id="hub-actions-heading" className="sr-only">
          Main actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link
            href="/patient-search?intent=book"
            className={cardClass}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <CalendarPlus className="h-6 w-6" aria-hidden />
            </div>
            <span className="text-headline-sm font-semibold text-on-surface">
              Book a visit
            </span>
            <span className="text-body-md text-on-surface-variant mt-2">
              Choose a doctor and time. Returning families verify with phone and date of birth.
            </span>
          </Link>

          <Link
            href="/checkin"
            className={cardClass}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <MapPin className="h-6 w-6" aria-hidden />
            </div>
            <span className="text-headline-sm font-semibold text-on-surface">
              I&apos;m here
            </span>
            <span className="text-body-md text-on-surface-variant mt-2">
              Check in with your booking code, or as a walk-in after a quick identity check.
            </span>
          </Link>
        </div>

        <Link
          href="/my-appointments"
          className={cn(cardClass, "sm:flex-row sm:items-center sm:gap-4 sm:min-h-[100px]")}
        >
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mb-4 sm:mb-0">
            <ClipboardList className="h-6 w-6" aria-hidden />
          </div>
          <div>
            <span className="text-headline-sm font-semibold text-on-surface block">
              My visits
            </span>
            <span className="text-body-md text-on-surface-variant mt-1 block">
              Find or cancel a booking with your phone and date of birth.
            </span>
          </div>
        </Link>
      </section>

      <p className="text-body-md text-on-surface-variant text-center sm:text-left">
        First time here?{" "}
        <Link
          href="/registration?intent=book"
          className="font-semibold text-primary hover:underline"
        >
          Register once
        </Link>
        , then book or check in faster next time.
      </p>

      <ClinicHelpStrip />
    </CareqPage>
  );
}

import Link from "next/link";
import {
  CalendarPlus,
  MapPin,
  ClipboardList,
  Bell,
  UserRound,
} from "lucide-react";
import { ClinicStatusBar } from "@/components/patient/ClinicStatusBar";
import { QueueTrackForm } from "@/components/patient/QueueTrackForm";
import { ClinicHelpStrip } from "@/components/patient/ClinicHelpStrip";
import { AnnouncementsStrip } from "@/components/patient/AnnouncementsStrip";
import { CareqPage } from "@/components/careq";
import { getClinicPublicInfo } from "@/lib/clinic-public";
import { cn } from "@/lib/utils";

const cardClass =
  "group flex flex-col rounded-lg border border-outline-variant bg-surface-container-lowest p-6 min-h-[160px] hover:border-primary hover:shadow-md transition-all focus-within:ring-2 focus-within:ring-ring";

export function PatientHub() {
  const clinic = getClinicPublicInfo();

  return (
    <CareqPage className="py-8 md:py-12 space-y-8">
      <header className="space-y-2">
        <p className="text-label-md font-semibold uppercase tracking-wide text-primary">
          {clinic.name}
        </p>
        <h1 className="text-headline-lg font-bold text-on-surface tracking-tight">
          CareQ
        </h1>
        <p className="text-body-lg text-on-surface-variant max-w-xl">
          Book ahead or walk in. Check in on your phone when you arrive — no kiosk,
          no paper ticket. Watch the lounge screens and your phone for your number.
        </p>
      </header>

      <ol className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-body-sm text-on-surface-variant">
        <li className="rounded-lg border border-outline-variant bg-white p-4">
          <span className="font-semibold text-primary">1. Book or walk in</span>
          <p className="mt-1">Schedule a slot for priority, or arrive and join the line.</p>
        </li>
        <li className="rounded-lg border border-outline-variant bg-white p-4">
          <span className="font-semibold text-primary">2. Phone check-in</span>
          <p className="mt-1">Enter your booking code or verify identity to get a queue number.</p>
        </li>
        <li className="rounded-lg border border-outline-variant bg-white p-4">
          <span className="font-semibold text-primary">3. Nurse, then doctor</span>
          <p className="mt-1">When called, go to triage, then your consultation or service.</p>
        </li>
      </ol>

      <AnnouncementsStrip />

      <ClinicStatusBar />

      <section
        className="rounded-lg border border-outline-variant bg-surface-container-lowest p-5 md:p-6 space-y-3"
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
          <Link href="/patient-search?intent=book" className={cardClass}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <CalendarPlus className="h-6 w-6" aria-hidden />
            </div>
            <span className="text-headline-sm font-semibold text-on-surface">
              Book a visit
            </span>
            <span className="text-body-md text-on-surface-variant mt-2">
              Choose a doctor and time. Returning patients verify with phone and date of birth.
            </span>
          </Link>

          <Link href="/checkin" className={cardClass}>
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
              <MapPin className="h-6 w-6" aria-hidden />
            </div>
            <span className="text-headline-sm font-semibold text-on-surface">
              I&apos;m here — check in
            </span>
            <span className="text-body-md text-on-surface-variant mt-2">
              Use your booking code, or walk in after a quick identity check on your phone.
            </span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link
            href="/my-appointments"
            className={cn(cardClass, "min-h-[120px]")}
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
              <ClipboardList className="h-5 w-5" aria-hidden />
            </div>
            <span className="text-headline-sm font-semibold text-on-surface block">
              My visits
            </span>
            <span className="text-body-sm text-on-surface-variant mt-1 block">
              Find, cancel, or reschedule with phone and date of birth.
            </span>
          </Link>

          <Link href="/patient-profile" className={cn(cardClass, "min-h-[120px]")}>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
              <UserRound className="h-5 w-5" aria-hidden />
            </div>
            <span className="text-headline-sm font-semibold text-on-surface block">
              My profile
            </span>
            <span className="text-body-sm text-on-surface-variant mt-1 block">
              View or update your registered details.
            </span>
          </Link>

          <Link href="/notifications" className={cn(cardClass, "min-h-[120px]")}>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
              <Bell className="h-5 w-5" aria-hidden />
            </div>
            <span className="text-headline-sm font-semibold text-on-surface block">
              Notifications
            </span>
            <span className="text-body-sm text-on-surface-variant mt-1 block">
              Confirmations, reminders, and queue updates.
            </span>
          </Link>
        </div>
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

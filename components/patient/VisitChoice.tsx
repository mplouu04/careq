import Link from "next/link";
import { History, UserPlus, Search, Clock } from "lucide-react";
import { CareqPage, CareqButton } from "@/components/careq";
import { PatientFlowBreadcrumb } from "@/components/patient/PatientFlowBreadcrumb";
import { cn } from "@/lib/utils";

const choiceCardClass =
  "group flex flex-col rounded-xl border border-outline-variant bg-surface-container-lowest p-lg hover:border-primary hover:shadow-md transition-all duration-200 focus-within:ring-2 focus-within:ring-ring min-h-[180px]";

export function VisitChoice() {
  return (
    <CareqPage className="py-10 md:py-14">
      <PatientFlowBreadcrumb flow="visit" />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl items-start">
        <div className="lg:col-span-7 space-y-lg">
          <div>
            <h1 className="text-headline-lg font-bold text-on-surface tracking-tight">
              How would you like to check in?
            </h1>
            <p className="text-body-lg text-on-surface-variant mt-2 max-w-lg">
              Returning patients can search existing records. New patients register
              once, then check in faster next time.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-md">
            <Link href="/patient-search" className={choiceCardClass}>
              <div className="flex items-center justify-between mb-md">
                <div className="w-11 h-11 rounded-full bg-secondary-container flex items-center justify-center text-primary">
                  <History className="h-5 w-5" aria-hidden />
                </div>
                <span className="text-label-sm px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                  ~2 min
                </span>
              </div>
              <span className="text-headline-sm font-semibold text-on-surface">
                I&apos;ve been here before
              </span>
              <span className="text-body-sm text-on-surface-variant mt-2">
                Search by name, phone, or patient number
              </span>
            </Link>

            <Link href="/registration" className={choiceCardClass}>
              <div className="flex items-center justify-between mb-md">
                <div className="w-11 h-11 rounded-full bg-secondary-container flex items-center justify-center text-primary">
                  <UserPlus className="h-5 w-5" aria-hidden />
                </div>
                <span className="text-label-sm px-2 py-0.5 rounded-full bg-muted text-on-surface-variant font-medium">
                  ~5 min
                </span>
              </div>
              <span className="text-headline-sm font-semibold text-on-surface">
                First visit
              </span>
              <span className="text-body-sm text-on-surface-variant mt-2">
                Quick registration, then check in
              </span>
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-md pt-sm">
            <CareqButton asChild variant="outline" size="sm">
              <Link href="/status">
                <Search className="h-4 w-4 mr-1" aria-hidden />
                Track queue status
              </Link>
            </CareqButton>
            <Link
              href="/"
              className={cn("text-body-sm text-on-surface-variant hover:text-primary")}
            >
              Back to home
            </Link>
          </div>
        </div>

        <aside className="lg:col-span-5 rounded-2xl border border-outline-variant bg-surface-container-low p-lg md:p-xl">
          <h2 className="text-headline-sm text-on-surface mb-md">What happens next</h2>
          <ul className="space-y-md text-body-md text-on-surface-variant">
            <li className="flex gap-md">
              <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
              <span>You receive a queue number and can follow progress on your phone.</span>
            </li>
            <li className="flex gap-md">
              <History className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
              <span>Appointment holders can verify with their reference code.</span>
            </li>
            <li className="flex gap-md">
              <UserPlus className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
              <span>New patients only need to register once per clinic.</span>
            </li>
          </ul>
        </aside>
      </div>
    </CareqPage>
  );
}

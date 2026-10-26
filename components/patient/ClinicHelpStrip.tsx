import Link from "next/link";
import { Phone, Clock, HelpCircle } from "lucide-react";
import { getClinicPublicInfo } from "@/lib/clinic-public";
import { cn } from "@/lib/utils";

type ClinicHelpStripProps = {
  className?: string;
  compact?: boolean;
};

/** Clear desk help for parents — phone, hours, short how-it-works. */
export function ClinicHelpStrip({ className, compact = false }: ClinicHelpStripProps) {
  const clinic = getClinicPublicInfo();

  return (
    <aside
      className={cn(
        "rounded-xl border border-outline-variant bg-surface-container-low",
        compact ? "p-4" : "p-5 md:p-6",
        className
      )}
      aria-label="Need help"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <HelpCircle className="h-5 w-5" aria-hidden />
        </div>
        <div className="min-w-0 space-y-2">
          <h2 className="text-headline-sm text-on-surface">Need help?</h2>
          <p className="text-body-md text-on-surface-variant">
            Call the front desk if you get stuck. Staff can help you book or check in.
          </p>
          <ul className="space-y-2 text-body-md text-on-surface">
            {clinic.phone ? (
              <li className="flex items-center gap-2 min-h-[44px]">
                <Phone className="h-4 w-4 text-primary shrink-0" aria-hidden />
                <a
                  href={`tel:${clinic.phone.replace(/\s/g, "")}`}
                  className="font-semibold text-primary underline-offset-2 hover:underline"
                >
                  {clinic.phone}
                </a>
              </li>
            ) : null}
            <li className="flex items-start gap-2">
              <Clock className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
              <span className="text-on-surface-variant">{clinic.hoursLabel}</span>
            </li>
          </ul>
          {!compact && (
            <ol className="mt-3 list-decimal list-inside space-y-1 text-body-sm text-on-surface-variant">
              <li>Book or check in with your phone and date of birth.</li>
              <li>Save your code (APT… or WALK-…).</li>
              <li>Track your place in line on this site.</li>
            </ol>
          )}
          <p className="text-body-sm text-on-surface-variant pt-1">
            <Link href="/privacy" className="text-primary hover:underline">
              Privacy
            </Link>
            {" · "}
            <Link href="/terms" className="text-primary hover:underline">
              Terms
            </Link>
          </p>
        </div>
      </div>
    </aside>
  );
}

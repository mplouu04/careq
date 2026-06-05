import { format } from "date-fns";
import { CareqCard } from "@/components/careq";

type AppointmentSummaryProps = {
  doctorLabel: string;
  typeLabel: string;
  date: string;
  time: string;
  reason?: string;
};

function formatTime12h(t: string): string {
  if (!t) return "—";
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${mStr ?? "00"} ${ampm}`;
}

export function AppointmentSummary({
  doctorLabel,
  typeLabel,
  date,
  time,
  reason,
}: AppointmentSummaryProps) {
  const dateLabel = date
    ? format(new Date(date + "T12:00:00"), "EEEE, MMM d, yyyy")
    : "—";

  return (
    <CareqCard className="p-lg sticky top-24">
      <h3 className="text-headline-sm text-on-surface mb-md">Booking summary</h3>
      <dl className="space-y-3 text-body-sm">
        <div>
          <dt className="text-on-surface-variant">Doctor</dt>
          <dd className="font-medium text-on-surface mt-0.5">{doctorLabel || "—"}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Type</dt>
          <dd className="font-medium text-on-surface mt-0.5">{typeLabel || "—"}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Date</dt>
          <dd className="font-medium text-on-surface mt-0.5">{dateLabel}</dd>
        </div>
        <div>
          <dt className="text-on-surface-variant">Time</dt>
          <dd className="font-medium text-on-surface mt-0.5">{formatTime12h(time)}</dd>
        </div>
        {reason && (
          <div>
            <dt className="text-on-surface-variant">Reason</dt>
            <dd className="text-on-surface mt-0.5">{reason}</dd>
          </div>
        )}
      </dl>
    </CareqCard>
  );
}

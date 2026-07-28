import { ClipboardList, Clock, Stethoscope } from "lucide-react";
import { MarketingSection } from "@/components/layout/MarketingSection";

const STEPS = [
  {
    icon: ClipboardList,
    title: "Check in",
    description: "Walk in or use your appointment reference. Search by name, phone, or patient number.",
  },
  {
    icon: Clock,
    title: "Track your place",
    description: "See your queue number, position, and estimated wait on your phone—updates live.",
  },
  {
    icon: Stethoscope,
    title: "Get called",
    description: "When it is your turn, your status shows your room. Proceed when called.",
  },
] as const;

export function HowItWorks() {
  return (
    <MarketingSection variant="muted" id="how-it-works">
      <div className="text-center max-w-2xl mx-auto mb-xl">
        <h2 className="text-headline-lg text-on-surface mb-md">How it works</h2>
        <p className="text-body-lg text-on-surface-variant">
          Three steps from arrival to consultation—designed for patients and front desk staff.
        </p>
      </div>
      <ol className="grid grid-cols-1 md:grid-cols-3 gap-lg list-none p-0 m-0">
        {STEPS.map(({ icon: Icon, title, description }, i) => (
          <li
            key={title}
            className="relative rounded-2xl border border-outline-variant bg-surface p-lg"
          >
            <span className="text-label-sm font-mono text-primary mb-md block">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-md">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="text-headline-sm text-on-surface mb-2">{title}</h3>
            <p className="text-body-md text-on-surface-variant">{description}</p>
          </li>
        ))}
      </ol>
    </MarketingSection>
  );
}

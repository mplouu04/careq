import { TabletSmartphone, Monitor, Tv } from "lucide-react";
import { MarketingSection } from "@/components/layout/MarketingSection";
import { Reveal } from "@/components/marketing/Reveal";

const STEPS = [
  {
    icon: TabletSmartphone,
    title: "Patient checks in at kiosk",
    description:
      "Walk-in or appointment—patients verify and join the queue from a kiosk or their phone.",
  },
  {
    icon: Monitor,
    title: "Staff manages queue from dashboard",
    description:
      "Front desk and clinicians call the next patient, assign rooms, and keep the day moving.",
  },
  {
    icon: Tv,
    title: "TV board updates; patient gets notified",
    description:
      "The waiting-room display stays live, and patients see when it’s their turn—no shouting names.",
  },
] as const;

export function HowItWorks() {
  return (
    <MarketingSection variant="default" id="how-it-works">
      <Reveal>
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-4xl font-extrabold text-[#111827] mb-4">How It Works</h2>
          <p className="text-base text-[#6B7280] leading-[1.7]">
            Three steps from arrival to consultation—designed for patients and front desk staff.
          </p>
        </div>
      </Reveal>
      <ol className="grid grid-cols-1 md:grid-cols-3 gap-6 list-none p-0 m-0">
        {STEPS.map(({ icon: Icon, title, description }, i) => (
          <Reveal key={title} delayMs={i * 80}>
            <li className="relative h-full rounded-xl border border-[#E2E5EA] bg-white p-6">
              <span className="text-xs font-mono font-semibold text-blue-600 mb-4 block">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div className="w-11 h-11 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-600 mb-4">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-lg font-bold text-[#111827] mb-2">{title}</h3>
              <p className="text-base text-[#6B7280] leading-[1.7]">{description}</p>
            </li>
          </Reveal>
        ))}
      </ol>
    </MarketingSection>
  );
}

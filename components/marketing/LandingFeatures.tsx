import { BellRing, LayoutDashboard, CalendarCheck } from "lucide-react";
import { MarketingSection } from "@/components/layout/MarketingSection";
import { Reveal } from "@/components/marketing/Reveal";

const FEATURES = [
  {
    icon: BellRing,
    title: "Patients Know Their Turn",
    description:
      "Live status on any phone means fewer “Am I next?” questions and a calmer waiting room.",
  },
  {
    icon: LayoutDashboard,
    title: "Staff Control the Day",
    description:
      "Call, skip, and complete from one dashboard—your TV board and patient view stay in sync.",
  },
  {
    icon: CalendarCheck,
    title: "Fewer Missed Appointments",
    description:
      "Optional reminders and clear queue visibility help patients show up and stay informed.",
  },
] as const;

export function LandingFeatures() {
  return (
    <MarketingSection variant="muted" id="features">
      <Reveal>
        <div className="mb-10 max-w-2xl">
          <h2 className="text-4xl font-extrabold text-[#111827] mb-4">
            Built for how clinics actually run
          </h2>
          <p className="text-base font-normal text-[#6B7280] leading-[1.7]">
            Everything your team needs to run the day—without switching tools or installing apps.
          </p>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {FEATURES.map(({ icon: Icon, title, description }, i) => (
          <Reveal key={title} delayMs={i * 80}>
            <div className="h-full rounded-xl border border-[#E2E5EA] border-l-[3px] border-l-transparent bg-white p-6 hover:shadow-md hover:-translate-y-1 hover:border-l-blue-600 transition-all duration-200 ease-out">
              <div className="w-11 h-11 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-600 mb-4">
                <Icon className="h-5 w-5" aria-hidden />
              </div>
              <h3 className="text-lg font-bold text-[#111827] mb-2">{title}</h3>
              <p className="text-base text-[#6B7280] leading-[1.7]">{description}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </MarketingSection>
  );
}

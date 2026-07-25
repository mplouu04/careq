import { Star } from "lucide-react";
import { MarketingSection } from "@/components/layout/MarketingSection";
import { Reveal } from "@/components/marketing/Reveal";

const TESTIMONIALS = [
  {
    quote:
      "Our waiting room finally feels calm. Patients check their phones instead of crowding the counter every five minutes.",
    clinic: "Summit Family Clinic",
    role: "Front Desk Staff, Baguio Clinic",
  },
  {
    quote:
      "The TV board and staff dashboard stay in sync. Calling the next patient takes one tap—no more paper lists.",
    clinic: "Lakeview Medical Center",
    role: "Clinic Manager, Laguna",
  },
  {
    quote:
      "Walk-ins and appointments in one queue. Setup took minutes and we didn’t need new hardware.",
    clinic: "CareFirst Outpatient",
    role: "Physician Owner, Quezon City",
  },
] as const;

function Stars() {
  return (
    <div className="flex gap-0.5 mb-3" aria-label="5 out of 5 stars">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" aria-hidden />
      ))}
    </div>
  );
}

export function LandingTestimonials() {
  return (
    <MarketingSection variant="default" id="testimonials">
      <Reveal>
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-4xl font-extrabold text-[#111827] mb-4">
            Clinics that run with less chaos
          </h2>
          <p className="text-base text-[#6B7280] leading-[1.7]">
            Hear from teams who switched from paper lists and shouted names to a live queue.
          </p>
        </div>
      </Reveal>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {TESTIMONIALS.map((t, i) => (
          <Reveal key={t.clinic} delayMs={i * 80}>
            <blockquote className="h-full rounded-xl border border-[#E2E5EA] bg-white p-6 shadow-sm flex flex-col">
              <Stars />
              <p className="text-base italic text-[#374151] leading-[1.7] flex-1">
                “{t.quote}”
              </p>
              <footer className="mt-5 pt-4 border-t border-[#E2E5EA]">
                <cite className="not-italic text-sm font-bold text-[#111827] block">
                  {t.clinic}
                </cite>
                <span className="text-sm text-[#6B7280]">{t.role}</span>
              </footer>
            </blockquote>
          </Reveal>
        ))}
      </div>
    </MarketingSection>
  );
}

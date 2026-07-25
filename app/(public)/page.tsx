import Link from "next/link";
import { LandingHero } from "@/components/marketing/LandingHero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { TrustStrip } from "@/components/marketing/TrustStrip";
import { LandingFeatures } from "@/components/marketing/LandingFeatures";
import { LandingPricing } from "@/components/marketing/LandingPricing";
import { LandingTestimonials } from "@/components/marketing/LandingTestimonials";
import { LandingContact } from "@/components/marketing/LandingContact";
import { MarketingSection } from "@/components/layout/MarketingSection";
import { Reveal } from "@/components/marketing/Reveal";

export default function HomePage() {
  return (
    <div className="landing-saas font-inter bg-[#F8F9FB] text-[#111827]">
      <LandingHero />
      <TrustStrip />
      <LandingFeatures />
      <HowItWorks />
      <LandingPricing />
      <LandingTestimonials />
      <LandingContact />

      <MarketingSection variant="primary" className="relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, white 0, transparent 40%), radial-gradient(circle at 80% 70%, white 0, transparent 35%)",
          }}
          aria-hidden
        />
        <Reveal>
          <div className="relative text-center max-w-2xl mx-auto py-4">
            <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-3">
              Ready to eliminate your waiting room chaos?
            </h2>
            <p className="text-base text-white/85 mb-8 leading-[1.7]">
              Set up in minutes. No hardware needed.
            </p>
            <Link
              href="/visit"
              className="inline-flex items-center justify-center h-14 min-h-[56px] px-8 rounded-lg bg-white text-blue-700 text-base font-bold shadow-lg hover:-translate-y-0.5 hover:shadow-xl active:translate-y-0 transition-all duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-white focus-visible:outline-offset-2"
            >
              Start Free Today
            </Link>
          </div>
        </Reveal>
      </MarketingSection>

      <div
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-[#E2E5EA] bg-white/95 backdrop-blur-md p-3"
        role="region"
        aria-label="Quick actions"
      >
        <Link
          href="/visit"
          className="flex items-center justify-center w-full h-12 min-h-[48px] rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600"
        >
          Check in now
        </Link>
      </div>
      <div className="h-20 md:hidden" aria-hidden />
    </div>
  );
}

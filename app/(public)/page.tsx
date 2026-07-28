import Link from "next/link";
import { LandingHero } from "@/components/marketing/LandingHero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { TrustStrip } from "@/components/marketing/TrustStrip";
import { LandingFeatures } from "@/components/marketing/LandingFeatures";
import { MarketingSection } from "@/components/layout/MarketingSection";
import { CareqButton } from "@/components/careq";

export default function HomePage() {
  return (
    <>
      <LandingHero />
      <HowItWorks />
      <TrustStrip />
      <LandingFeatures />

      <MarketingSection variant="primary">
        <div className="flex flex-col md:flex-row items-center justify-between gap-lg">
          <div>
            <h2 className="text-headline-lg text-primary-foreground mb-2">
              Ready to streamline your clinic?
            </h2>
            <p className="text-body-md text-primary-foreground/85 max-w-lg">
              Start with patient check-in today. Staff can log in to manage queues
              from the dashboard.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <CareqButton
              asChild
              size="hero"
              className="bg-primary-foreground text-primary hover:bg-primary-foreground/90 w-full sm:w-auto"
            >
              <Link href="/visit">Get started</Link>
            </CareqButton>
            <CareqButton
              asChild
              size="hero"
              variant="outline"
              className="border-2 border-primary-foreground text-primary-foreground hover:bg-white/10 w-full sm:w-auto"
            >
              <Link href="/login">Staff login</Link>
            </CareqButton>
          </div>
        </div>
      </MarketingSection>

      <div
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-outline-variant bg-surface/95 backdrop-blur-md p-3 safe-area-pb"
        role="region"
        aria-label="Quick actions"
      >
        <CareqButton asChild className="w-full" size="lg">
          <Link href="/visit">Check in now</Link>
        </CareqButton>
      </div>
      <div className="h-20 md:hidden" aria-hidden />
    </>
  );
}

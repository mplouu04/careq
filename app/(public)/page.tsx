import Link from "next/link";
import { LandingHero } from "@/components/marketing/LandingHero";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { TrustStrip } from "@/components/marketing/TrustStrip";
import { LandingFeatures } from "@/components/marketing/LandingFeatures";
import { CareqButton } from "@/components/careq";

export default function HomePage() {
  return (
    <>
      <LandingHero />
      <HowItWorks />
      <TrustStrip />
      <LandingFeatures />

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

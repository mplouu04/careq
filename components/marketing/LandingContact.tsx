import Link from "next/link";
import { Mail, LogIn } from "lucide-react";
import { MarketingSection } from "@/components/layout/MarketingSection";
import { Reveal } from "@/components/marketing/Reveal";

export function LandingContact() {
  return (
    <MarketingSection variant="muted" id="contact">
      <Reveal>
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-4xl font-extrabold text-[#111827] mb-4">Get in touch</h2>
          <p className="text-base text-[#6B7280] leading-[1.7] mb-8">
            Questions about setup, pricing, or bringing CareQ to your clinic? We’re here to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:support@careq.ph"
              className="inline-flex items-center justify-center gap-2 h-12 min-h-[48px] px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 transition-all duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 focus-visible:outline-offset-2"
            >
              <Mail className="h-4 w-4" aria-hidden />
              Email support@careq.ph
            </a>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 h-12 min-h-[48px] px-6 rounded-lg border border-[#E2E5EA] bg-white text-[#111827] text-sm font-bold hover:border-blue-600 hover:text-blue-600 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 focus-visible:outline-offset-2"
            >
              <LogIn className="h-4 w-4" aria-hidden />
              Staff Login
            </Link>
          </div>
        </div>
      </Reveal>
    </MarketingSection>
  );
}

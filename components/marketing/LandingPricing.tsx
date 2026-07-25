"use client";

import { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { MarketingSection } from "@/components/layout/MarketingSection";
import { Reveal } from "@/components/marketing/Reveal";
import { cn } from "@/lib/utils";

type Billing = "monthly" | "annual";

const PLANS = [
  {
    id: "free",
    name: "Free Trial",
    description: "Try CareQ with your team—no credit card required.",
    monthly: 0,
    annual: 0,
    cta: "Start Free Today",
    href: "/visit",
    features: [
      "Up to 50 check-ins / month",
      "Live patient status page",
      "1 staff dashboard login",
      "Email support",
    ],
    popular: false,
  },
  {
    id: "starter",
    name: "Starter",
    description: "For single-location clinics ready to go paperless.",
    monthly: 1499,
    annual: 1199,
    cta: "Get Started",
    href: "/visit",
    features: [
      "Unlimited daily check-ins",
      "TV queue board display",
      "Up to 5 staff accounts",
      "Appointment booking",
      "Email reminders",
    ],
    popular: true,
  },
  {
    id: "clinic",
    name: "Clinic",
    description: "For growing practices that need multi-room control.",
    monthly: 2999,
    annual: 2399,
    cta: "Talk to Us",
    href: "#contact",
    features: [
      "Everything in Starter",
      "Unlimited staff accounts",
      "Multiple rooms & doctors",
      "Priority support",
      "Onboarding assistance",
    ],
    popular: false,
  },
] as const;

function formatPrice(amount: number) {
  if (amount === 0) return "₱0";
  return `₱${amount.toLocaleString("en-PH")}`;
}

export function LandingPricing() {
  const [billing, setBilling] = useState<Billing>("monthly");

  return (
    <MarketingSection variant="muted" id="pricing">
      <Reveal>
        <div className="text-center max-w-2xl mx-auto mb-8">
          <h2 className="text-4xl font-extrabold text-[#111827] mb-4">Simple, transparent pricing</h2>
          <p className="text-base text-[#6B7280] leading-[1.7]">
            Start free. Upgrade when your clinic is ready—no hardware required.
          </p>
        </div>
      </Reveal>

      <Reveal delayMs={60}>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
          <div
            className="inline-flex p-1 rounded-lg border border-[#E2E5EA] bg-[#F8F9FB]"
            role="group"
            aria-label="Billing period"
          >
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={cn(
                "min-h-[44px] px-4 rounded-md text-sm font-semibold transition-all duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600",
                billing === "monthly"
                  ? "bg-white text-[#111827] shadow-sm"
                  : "text-[#6B7280] hover:text-blue-600"
              )}
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("annual")}
              className={cn(
                "min-h-[44px] px-4 rounded-md text-sm font-semibold transition-all duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600",
                billing === "annual"
                  ? "bg-white text-[#111827] shadow-sm"
                  : "text-[#6B7280] hover:text-blue-600"
              )}
            >
              Annual
            </button>
          </div>
          <span className="inline-flex items-center rounded-full bg-blue-600/10 text-blue-700 text-xs font-bold px-3 py-1.5">
            Save 20%
          </span>
        </div>
      </Reveal>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-4 lg:gap-6">
        {PLANS.map((plan, i) => {
          const price = billing === "monthly" ? plan.monthly : plan.annual;
          return (
            <Reveal key={plan.id} delayMs={i * 80}>
              <article
                className={cn(
                  "relative h-full flex flex-col rounded-xl border bg-white p-6 shadow-sm",
                  plan.popular
                    ? "border-blue-600 border-2 shadow-md"
                    : "border-[#E2E5EA]"
                )}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 text-white text-xs font-bold px-3 py-1">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-bold text-[#111827]">{plan.name}</h3>
                <p className="text-sm text-[#6B7280] mt-1 min-h-[40px]">{plan.description}</p>
                <div className="mt-4 mb-6">
                  <span className="text-4xl font-extrabold text-[#111827]">
                    {formatPrice(price)}
                  </span>
                  {price > 0 && (
                    <span className="text-sm text-[#6B7280] ml-1">
                      /mo{billing === "annual" ? ", billed annually" : ""}
                    </span>
                  )}
                  {price === 0 && (
                    <span className="block text-sm text-[#6B7280] mt-1">
                      14-day free trial · no card needed
                    </span>
                  )}
                </div>
                <ul className="space-y-3 mb-8 flex-1">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2 text-sm text-[#374151]">
                      <Check className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" aria-hidden />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.href.startsWith("#") ? (
                  <a
                    href={plan.href}
                    className={cn(
                      "inline-flex items-center justify-center h-12 min-h-[48px] rounded-lg text-sm font-bold transition-all duration-150 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 focus-visible:outline-offset-2",
                      plan.popular
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                        : "border border-[#E2E5EA] text-[#111827] hover:border-blue-600 hover:text-blue-600"
                    )}
                  >
                    {plan.cta}
                  </a>
                ) : (
                  <Link
                    href={plan.href}
                    className={cn(
                      "inline-flex items-center justify-center h-12 min-h-[48px] rounded-lg text-sm font-bold transition-all duration-150 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 focus-visible:outline-offset-2",
                      plan.popular
                        ? "bg-blue-600 text-white hover:bg-blue-700 shadow-md"
                        : "border border-[#E2E5EA] text-[#111827] hover:border-blue-600 hover:text-blue-600"
                    )}
                  >
                    {plan.cta}
                  </Link>
                )}
              </article>
            </Reveal>
          );
        })}
      </div>
    </MarketingSection>
  );
}

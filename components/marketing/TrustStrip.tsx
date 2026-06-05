import { Lock, Shield, HeartPulse } from "lucide-react";
import { MarketingSection } from "@/components/layout/MarketingSection";

const TRUST_ITEMS = [
  {
    icon: Shield,
    title: "Built for clinics",
    description: "Role-based staff access and audit-friendly queue actions.",
  },
  {
    icon: Lock,
    title: "Privacy-first check-in",
    description: "Patient data used only for visit management at your facility.",
  },
  {
    icon: HeartPulse,
    title: "Real-time transparency",
    description: "Reduce front-desk questions with live queue status for patients.",
  },
] as const;

export function TrustStrip() {
  return (
    <MarketingSection>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md border border-outline-variant rounded-2xl p-lg md:p-xl bg-surface-container-lowest">
        {TRUST_ITEMS.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex gap-md">
            <div className="shrink-0 w-10 h-10 rounded-lg bg-secondary-container flex items-center justify-center text-primary">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h3 className="text-label-md font-semibold text-on-surface">{title}</h3>
              <p className="text-body-sm text-on-surface-variant mt-1">{description}</p>
            </div>
          </div>
        ))}
      </div>
    </MarketingSection>
  );
}

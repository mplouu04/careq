import { Users, Clock, Radio, MapPin } from "lucide-react";
import { Reveal } from "@/components/marketing/Reveal";

const STATS = [
  {
    icon: Users,
    value: "500+",
    label: "patients managed",
  },
  {
    icon: Clock,
    value: "Zero",
    label: "wait time confusion",
  },
  {
    icon: Radio,
    value: "Real-time",
    label: "updates",
  },
  {
    icon: MapPin,
    value: "Philippine",
    label: "built",
  },
] as const;

export function TrustStrip() {
  return (
    <section className="px-6 pb-8 md:pb-12 -mt-4 md:-mt-8 relative z-10 bg-transparent">
      <div className="max-w-[1140px] mx-auto">
        <Reveal>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {STATS.map(({ icon: Icon, value, label }, i) => (
              <div
                key={label}
                className="rounded-xl border border-[#E2E5EA] bg-white p-5 shadow-sm flex flex-col gap-3"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="w-10 h-10 rounded-lg bg-blue-600/10 flex items-center justify-center text-blue-600">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <div>
                  <p className="text-xl font-extrabold text-[#111827] leading-tight">{value}</p>
                  <p className="text-sm text-[#6B7280] mt-0.5 capitalize">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

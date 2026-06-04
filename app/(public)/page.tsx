import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BadgeCheck,
  RefreshCw,
  Smartphone,
  MessageSquare,
} from "lucide-react";
import { CareqButton } from "@/components/careq";

const FEATURES = [
  {
    icon: RefreshCw,
    title: "Real-time Updates",
    description:
      "Live dashboard synchronization ensures patients and staff are always aligned on wait times and queue positions.",
  },
  {
    icon: Smartphone,
    title: "Works on Any Device",
    description:
      "Access the full clinical dashboard from a desktop or allow patients to check in from their mobile browsers—no app required.",
  },
  {
    icon: MessageSquare,
    title: "SMS Reminders",
    description:
      "Automated text notifications alert patients when their turn is approaching, reducing missed appointments and lobby crowding.",
  },
] as const;

const STATS = [
  { value: "15m", label: "Avg. Wait Reduction" },
  { value: "98%", label: "Patient Satisfaction" },
  { value: "2.4k+", label: "Clinics Trusted" },
] as const;

export default function HomePage() {
  return (
    <>
      <section className="relative overflow-hidden pt-xxl pb-xxl px-margin-mobile md:px-margin-desktop">
        <div className="max-w-careq mx-auto grid grid-cols-1 lg:grid-cols-12 gap-gutter items-center">
          <div className="lg:col-span-7 space-y-xl z-10">
            <div className="inline-flex items-center gap-xs px-md py-xs bg-secondary-container text-on-secondary-container rounded-full">
              <BadgeCheck className="h-[18px] w-[18px] text-primary" aria-hidden />
              <span className="text-label-md uppercase tracking-wider">
                Next-Gen Patient Experience
              </span>
            </div>

            <h1 className="text-[48px] md:text-[64px] leading-tight font-bold text-on-surface">
              Your Clinic,{" "}
              <span className="text-primary italic">Smarter.</span>
            </h1>

            <p className="text-body-lg text-on-surface-variant max-w-xl">
              Eliminate waiting room congestion with a digital queuing system
              designed for modern healthcare. Empower patients with real-time
              transparency and clinicians with seamless flow management.
            </p>

            <div className="flex flex-col sm:flex-row gap-md pt-md">
              <CareqButton
                asChild
                size="hero"
                className="shadow-lg shadow-primary/20 active:scale-[0.98]"
              >
                <Link href="/visit">
                  Check In
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
              </CareqButton>
              <CareqButton
                asChild
                size="hero"
                variant="outline"
                className="border-2 border-primary text-primary hover:bg-primary/5 active:scale-[0.98]"
              >
                <Link href="/appointments">Book Appointment</Link>
              </CareqButton>
            </div>

            <div className="grid grid-cols-3 gap-md pt-xl border-t border-outline-variant">
              {STATS.map(({ value, label }) => (
                <div key={label}>
                  <div className="text-headline-md text-primary font-semibold">{value}</div>
                  <div className="text-body-sm text-on-surface-variant">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 relative mt-xl lg:mt-0">
            <div className="relative w-full aspect-[4/5] rounded-[2rem] overflow-hidden shadow-2xl border border-white/20">
              <Image
                src="/images/hero-clinic.jpg"
                alt="Clinician with tablet in a modern clinic"
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
              <div className="absolute top-md right-md glass-card p-md rounded-xl border border-white/40 shadow-xl">
                <div className="flex items-center gap-sm">
                  <span className="w-2 h-2 rounded-full bg-status-called animate-pulse" />
                  <span className="text-label-md text-on-surface">Live Status: Active</span>
                </div>
              </div>
              <div className="absolute bottom-lg left-[-20px] md:left-4 glass-card p-lg rounded-xl border border-white/40 shadow-2xl max-w-[240px]">
                <span className="text-label-sm text-primary uppercase">Current Patient</span>
                <p className="text-headline-sm text-on-surface">Queue #A124</p>
                <div className="h-1 w-full bg-outline-variant rounded-full mt-xs overflow-hidden">
                  <div className="h-full bg-primary w-2/3" />
                </div>
                <span className="text-body-sm text-on-surface-variant">ETA: 4 Minutes</span>
              </div>
            </div>
            <div
              className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/5 rounded-full blur-[100px]"
              aria-hidden
            />
          </div>
        </div>
      </section>

      <section className="py-xxl px-margin-mobile md:px-margin-desktop bg-surface-container-lowest">
        <div className="max-w-careq mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-xxl gap-lg">
            <div className="max-w-2xl">
              <h2 className="text-headline-lg text-on-surface mb-md">
                Seamless Operations, Enhanced Care
              </h2>
              <p className="text-body-lg text-on-surface-variant">
                Focus on what matters most—your patients—while CAREQ handles the
                flow with surgical precision.
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group p-lg bg-surface border border-outline-variant rounded-2xl hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="text-headline-sm text-on-surface mb-2">{title}</h3>
                <p className="text-body-md text-on-surface-variant">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-xl px-margin-mobile md:px-margin-desktop">
        <div className="max-w-careq mx-auto rounded-[2rem] bg-primary overflow-hidden relative">
          <div
            className="absolute top-0 right-0 w-1/2 h-full bg-white/10 skew-x-[-20deg] translate-x-1/2"
            aria-hidden
          />
          <div className="relative p-10 md:p-12 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <h2 className="text-headline-lg text-primary-foreground mb-2">
                Ready to transform your clinic flow?
              </h2>
              <p className="text-body-md text-primary-foreground/80">
                Join 2,000+ medical facilities optimizing patient intake today.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <CareqButton
                asChild
                size="hero"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                <Link href="/visit">Get Started Free</Link>
              </CareqButton>
              <CareqButton
                asChild
                size="hero"
                variant="outline"
                className="border-2 border-primary-foreground text-primary-foreground hover:bg-white/10"
              >
                <Link href="/login">Staff Login</Link>
              </CareqButton>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

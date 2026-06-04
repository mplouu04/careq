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
      <section className="relative overflow-hidden pt-12 pb-16 md:pt-16 md:pb-24 px-margin-mobile md:px-margin-desktop">
        <div className="max-w-careq mx-auto grid grid-cols-1 lg:grid-cols-12 gap-gutter items-center">
          <div className="lg:col-span-7 space-y-8 z-10">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-secondary-container text-on-secondary-container rounded-full">
              <BadgeCheck className="h-4 w-4 text-primary" aria-hidden />
              <span className="text-label-md uppercase tracking-wider">
                Next-Gen Patient Experience
              </span>
            </div>

            <h1 className="text-[2.5rem] md:text-[4rem] leading-tight font-bold text-foreground">
              Your Clinic,{" "}
              <span className="text-primary italic">Smarter.</span>
            </h1>

            <p className="text-body-lg text-muted-foreground max-w-xl">
              Eliminate waiting room congestion with a digital queuing system
              designed for modern healthcare. Empower patients with real-time
              transparency and clinicians with seamless flow management.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <CareqButton asChild className="h-14 px-8 rounded-xl shadow-lg shadow-primary/20">
                <Link href="/visit">
                  Check In
                  <ArrowRight className="h-5 w-5" aria-hidden />
                </Link>
              </CareqButton>
              <CareqButton
                asChild
                variant="outline"
                className="h-14 px-8 rounded-xl border-2 border-primary text-primary hover:bg-primary/5"
              >
                <Link href="/patient-search">Book Appointment</Link>
              </CareqButton>
            </div>

            <div className="grid grid-cols-3 gap-4 pt-8 border-t border-border">
              {STATS.map(({ value, label }) => (
                <div key={label}>
                  <div className="text-headline-md text-primary">{value}</div>
                  <div className="text-body-sm text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-5 relative mt-8 lg:mt-0">
            <div className="relative w-full aspect-[4/5] rounded-[2rem] overflow-hidden shadow-2xl border border-border">
              <Image
                src="/images/profile.png"
                alt="Clinician with tablet in a modern clinic"
                fill
                className="object-cover"
                priority
                sizes="(max-width: 1024px) 100vw, 40vw"
              />
              <div className="absolute top-4 right-4 glass-card p-3 rounded-xl border border-white/40 shadow-xl">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-status-called animate-pulse" />
                  <span className="text-label-md text-foreground">Live Status: Active</span>
                </div>
              </div>
              <div className="absolute bottom-6 left-4 glass-card p-4 rounded-xl border border-white/40 shadow-2xl max-w-[240px]">
                <span className="text-label-sm text-primary uppercase">Current Patient</span>
                <p className="text-headline-sm text-foreground">Queue #A124</p>
                <div className="h-1 w-full bg-border rounded-full mt-2 overflow-hidden">
                  <div className="h-full bg-primary w-2/3" />
                </div>
                <span className="text-body-sm text-muted-foreground">ETA: 4 Minutes</span>
              </div>
            </div>
            <div
              className="absolute -z-10 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-primary/5 rounded-full blur-[100px]"
              aria-hidden
            />
          </div>
        </div>
      </section>

      <section className="py-16 px-margin-mobile md:px-margin-desktop bg-card">
        <div className="max-w-careq mx-auto">
          <div className="mb-12 max-w-2xl">
            <h2 className="text-headline-lg text-foreground mb-4">
              Seamless Operations, Enhanced Care
            </h2>
            <p className="text-body-lg text-muted-foreground">
              Focus on what matters most—your patients—while CAREQ handles the
              flow with surgical precision.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <div
                key={title}
                className="group p-6 bg-background border border-border rounded-2xl hover:shadow-lg transition-shadow duration-300"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-6 group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <Icon className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="text-headline-sm text-foreground mb-2">{title}</h3>
                <p className="text-body-md text-muted-foreground">{description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-12 px-margin-mobile md:px-margin-desktop">
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
                variant="secondary"
                className="bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                <Link href="/visit">Get Started Free</Link>
              </CareqButton>
              <CareqButton
                asChild
                variant="outline"
                className="border-primary-foreground text-primary-foreground hover:bg-white/10"
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

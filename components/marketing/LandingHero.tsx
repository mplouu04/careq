"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function LandingHero() {
  const router = useRouter();
  const [queueRef, setQueueRef] = useState("");

  function trackQueue(e: React.FormEvent) {
    e.preventDefault();
    const ref = queueRef.trim();
    if (ref) router.push(`/status/${encodeURIComponent(ref)}`);
  }

  return (
    <section className="relative overflow-hidden pt-16 pb-16 md:pt-24 md:pb-20 px-6">
      <div
        className="absolute inset-0 -z-10 bg-gradient-to-b from-[#F8F9FB] to-[#EFF4FE]"
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10 opacity-[0.35]"
        style={{
          backgroundImage:
            "linear-gradient(#E2E5EA 1px, transparent 1px), linear-gradient(90deg, #E2E5EA 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <div className="max-w-[1140px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
        <div className="lg:col-span-6 space-y-6 z-10">
          <h1 className="text-[36px] md:text-[56px] font-extrabold leading-[1.1] tracking-[-0.02em] text-[#111827]">
            The Smarter Queue System for Philippine Clinics
          </h1>

          <p className="text-xl font-normal text-[#6B7280] max-w-[600px] leading-[1.6]">
            Give every patient a clear place in line—and give your front desk the calm of a
            live, shared queue. No apps to install. No more “Who’s next?”
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href="/visit"
              className="inline-flex items-center justify-center gap-2 h-[52px] min-h-[52px] px-6 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-base font-bold shadow-md shadow-blue-600/20 hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 transition-all duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 focus-visible:outline-offset-2"
            >
              Get Started Free
              <ArrowRight className="h-5 w-5" aria-hidden />
            </Link>
            <a
              href="#how-it-works"
              className="inline-flex items-center justify-center h-[52px] min-h-[52px] px-6 rounded-lg border-2 border-[#E2E5EA] bg-white text-[#111827] text-base font-bold hover:border-blue-600 hover:text-blue-600 hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 focus-visible:outline-offset-2"
            >
              See How It Works
            </a>
          </div>

          <p className="text-sm font-medium text-[#6B7280]">
            Trusted by clinics across the Philippines
          </p>

          <div className="max-w-md pt-6 border-t border-[#E2E5EA] space-y-2">
            <p className="text-sm text-[#6B7280]">
              Already have a reference? Track your place in line.
            </p>
            <form onSubmit={trackQueue} className="flex flex-col sm:flex-row gap-2">
              <label htmlFor="hero-queue-ref" className="sr-only">
                Queue reference number
              </label>
              <Input
                id="hero-queue-ref"
                placeholder="Track queue (e.g. WALK-5)"
                value={queueRef}
                onChange={(e) => setQueueRef(e.target.value)}
                className="font-mono h-11 bg-white border-[#E2E5EA] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600"
              />
              <Button
                type="submit"
                variant="secondary"
                className="h-11 shrink-0 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150"
              >
                View status
              </Button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-6 relative">
          <div className="relative w-full aspect-[4/5] sm:aspect-[16/11] lg:aspect-[4/5] rounded-2xl overflow-hidden shadow-xl border border-[#E2E5EA] bg-white">
            <Image
              src="/images/hero-clinic.jpg"
              alt="Clinician using a tablet for live patient queue management in a modern clinic"
              fill
              className="object-cover"
              priority
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
            <div className="absolute top-4 right-4 rounded-lg border border-[#E2E5EA]/80 bg-white/95 backdrop-blur px-4 py-2 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" aria-hidden />
                <span className="text-xs font-semibold uppercase tracking-wide text-[#111827]">
                  Live queue sync
                </span>
              </div>
            </div>
            <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-[#E2E5EA] bg-white/95 backdrop-blur p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="text-xs font-medium uppercase tracking-wide text-[#6B7280]">
                    Now serving
                  </span>
                  <p className="font-mono text-3xl font-bold text-blue-600 mt-0.5">WALK-12</p>
                  <p className="text-sm text-[#6B7280]">Room 2 · ~4 min wait</p>
                </div>
                <div className="rounded-lg bg-[#EFF4FE] px-3 py-2 text-right">
                  <p className="text-[10px] font-semibold uppercase text-blue-800">TV Board</p>
                  <p className="text-xs text-[#6B7280] mt-0.5">Waiting: 8</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

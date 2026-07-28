"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, BadgeCheck } from "lucide-react";
import { CareqButton } from "@/components/careq";
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
    <section className="relative overflow-hidden pt-xxl pb-xl px-margin-mobile md:px-margin-desktop">
      <div className="max-w-careq mx-auto grid grid-cols-1 lg:grid-cols-12 gap-gutter items-center">
        <div className="lg:col-span-7 space-y-lg z-10">
          <div className="inline-flex items-center gap-xs px-md py-xs bg-secondary-container text-on-secondary-container rounded-full">
            <BadgeCheck className="h-[18px] w-[18px] text-primary" aria-hidden />
            <span className="text-label-md uppercase tracking-wider">
              Clinic queue management
            </span>
          </div>

          <h1 className="text-[40px] md:text-[56px] leading-[1.1] font-bold text-on-surface tracking-tight">
            Your clinic,{" "}
            <span className="text-primary">without the waiting-room chaos.</span>
          </h1>

          <p className="text-body-lg text-on-surface-variant max-w-xl">
            Patients check in from their phone. Staff see live queues. Everyone
            knows who is next—no app install required.
          </p>

          <div className="flex flex-col sm:flex-row gap-md">
            <CareqButton asChild size="hero" className="shadow-md shadow-primary/15">
              <Link href="/visit">
                Check in now
                <ArrowRight className="h-5 w-5" aria-hidden />
              </Link>
            </CareqButton>
            <CareqButton asChild size="hero" variant="outline">
              <Link href="/appointments">Book appointment</Link>
            </CareqButton>
          </div>

          <div className="max-w-md pt-md border-t border-outline-variant/60 space-y-2">
            <p className="text-body-sm text-on-surface-variant">
              Already have a reference? Track your place in line.
            </p>
          <form
            onSubmit={trackQueue}
            className="flex flex-col sm:flex-row gap-2"
          >
            <label htmlFor="hero-queue-ref" className="sr-only">
              Queue reference number
            </label>
            <Input
              id="hero-queue-ref"
              placeholder="Track queue (e.g. WALK-5)"
              value={queueRef}
              onChange={(e) => setQueueRef(e.target.value)}
              className="font-mono h-11 bg-surface-container-lowest"
            />
            <Button type="submit" variant="secondary" className="h-11 shrink-0">
              View status
            </Button>
          </form>
          </div>
        </div>

        <div className="hidden md:block lg:col-span-5 relative mt-lg lg:mt-0">
          <div className="relative w-full aspect-[4/5] rounded-2xl overflow-hidden shadow-xl border border-outline-variant">
            <Image
              src="/images/hero-clinic.jpg"
              alt="Clinician with tablet in a modern clinic"
              fill
              className="object-cover"
              priority
              sizes="(max-width: 1024px) 100vw, 40vw"
            />
            <div className="absolute top-md right-md rounded-lg border border-outline-variant/80 bg-surface-container-lowest/95 backdrop-blur px-md py-sm shadow-sm">
              <div className="flex items-center gap-sm">
                <span className="w-2 h-2 rounded-full bg-status-called" aria-hidden />
                <span className="text-label-md text-on-surface">Live queue sync</span>
              </div>
            </div>
            <div className="absolute bottom-md left-md right-md rounded-xl border border-outline-variant bg-surface-container-lowest/95 backdrop-blur p-md shadow-sm">
              <span className="text-label-sm text-on-surface-variant uppercase">
                Now serving
              </span>
              <p className="font-mono text-headline-lg text-primary mt-0.5">WALK-12</p>
              <p className="text-body-sm text-on-surface-variant">Room 2 · ~4 min wait</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

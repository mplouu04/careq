"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  CareqCard,
  CareqButton,
  FormLabel,
  FormInput,
  FormSelect,
  FormError,
  FormWarning,
  SuccessCard,
} from "@/components/careq";

type ApptType = { id: string; name: string };

type AppointmentPreview = {
  fullname: string;
  appointment_date: string;
  doctor: string;
  appointment: string;
  time: string;
  reason: string;
  appnumber: string;
  id: string;
};

export function CheckinForm() {
  const params = useSearchParams();
  const patientId = params.get("patientId");

  const [types, setTypes] = useState<ApptType[]>([]);
  const [apptType, setApptType] = useState("");
  const [reason, setReason] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [ref, setRef] = useState("");
  const [refLookup, setRefLookup] = useState<AppointmentPreview | null>(null);
  const [refLookupError, setRefLookupError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successRef, setSuccessRef] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"appointment" | "walk-in">("appointment");

  useEffect(() => {
    const mode = params.get("tab") ?? params.get("mode");
    if (mode === "appointment") setActiveTab("appointment");
    else if (mode === "walk-in" || mode === "walkin") setActiveTab("walk-in");
    else if (patientId) setActiveTab("walk-in");
  }, [params, patientId]);

  useEffect(() => {
    fetch("/api/appointment-types")
      .then((r) => (r.ok ? r.json() : { types: [] }))
      .then((d) => setTypes(d.types ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (ref.length < 3) {
      setRefLookup(null);
      setRefLookupError("");
      return;
    }
    const t = setTimeout(async () => {
      setLookingUp(true);
      try {
        const res = await fetch(
          `/api/checkin?appointmentID=${encodeURIComponent(ref.toUpperCase())}`
        );
        const data = await res.json();
        if (data.success && data.appointment?.[0]) {
          setRefLookup(data.appointment[0]);
          setRefLookupError("");
        } else {
          setRefLookup(null);
          setRefLookupError("Reference not found.");
        }
      } catch {
        setRefLookup(null);
        setRefLookupError("Lookup failed.");
      } finally {
        setLookingUp(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [ref]);

  async function walkInCheckin() {
    if (!patientId) {
      setError("Search or register first.");
      return;
    }
    if (!apptType || !reason.trim() || !termsAgreed) {
      setError("Complete all required fields.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "walk-in",
        patientId,
        appointmentType: apptType,
        additionalinfo: reason,
        termsAgreement: "on",
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Check-in failed");
      return;
    }
    setSuccessRef(data.queueNumber ?? data.quenumber);
  }

  async function appointmentCheckin() {
    if (!refLookup) {
      setError("Enter a valid appointment reference.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: refLookup.appnumber }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Check-in failed");
      return;
    }
    setSuccessRef(data.queueNumber ?? data.quenumber);
  }

  const tabClass = (tab: "appointment" | "walk-in") =>
    cn(
      "flex-1 min-h-[48px] py-3 px-2 text-body-sm font-medium transition-colors duration-200 border-b-2 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      activeTab === tab
        ? "border-primary text-primary bg-surface-container-lowest"
        : "border-transparent text-on-surface-variant hover:text-foreground bg-muted/30"
    );

  if (successRef) {
    return (
      <SuccessCard
        reference={successRef}
        message="You are checked in."
        primaryCta={{
          label: "Track your status",
          href: `/status/${encodeURIComponent(successRef)}`,
        }}
      />
    );
  }

  return (
    <CareqCard className="overflow-hidden max-w-lg">
      <div className="px-6 py-4 border-b border-border text-center">
        <h3 className="text-headline-sm text-foreground">Check in</h3>
        <p className="text-body-sm text-on-surface-variant mt-0.5">
          Appointment or walk-in.
        </p>
      </div>

      <div className="flex border-b border-border">
        <button type="button" onClick={() => setActiveTab("appointment")} className={tabClass("appointment")}>
          Appointment
        </button>
        <button
          type="button"
          disabled={!patientId}
          onClick={() => patientId && setActiveTab("walk-in")}
          className={cn(
            tabClass("walk-in"),
            !patientId && "text-on-surface-variant/50 cursor-not-allowed"
          )}
        >
          Walk-in
        </button>
      </div>

      <div className="px-6 py-5">
        {error && <FormError message={error} />}

        {activeTab === "appointment" && (
          <div className="space-y-4">
            <div>
              <FormLabel required>Reference</FormLabel>
              <FormInput
                type="text"
                value={ref}
                onChange={(e) => setRef(e.target.value.toUpperCase())}
                placeholder="APT..."
                className="uppercase font-mono-careq"
              />
              {lookingUp && (
                <p className="text-body-sm text-on-surface-variant mt-1">Looking up…</p>
              )}
              {refLookupError && !lookingUp && (
                <p className="text-body-sm text-destructive mt-1">{refLookupError}</p>
              )}
            </div>

            {refLookup && (
              <div className="rounded-xl border border-outline-variant p-3 text-body-sm bg-secondary-container/30">
                <p className="font-semibold text-on-surface">{refLookup.fullname}</p>
                <p className="text-on-surface-variant">
                  {refLookup.appointment_date} · {refLookup.time}
                </p>
              </div>
            )}

            <CareqButton
              type="button"
              className="w-full cursor-pointer"
              disabled={loading || !refLookup}
              onClick={appointmentCheckin}
            >
              {loading ? "Checking in…" : "Check in"}
            </CareqButton>
          </div>
        )}

        {activeTab === "walk-in" && (
          <div className="space-y-4">
            {!patientId && (
              <FormWarning>
                <Link href="/patient-search" className="text-primary hover:underline">
                  Search
                </Link>{" "}
                or{" "}
                <Link href="/registration" className="text-primary hover:underline">
                  register
                </Link>{" "}
                first.
              </FormWarning>
            )}

            <div>
              <FormLabel required>Visit type</FormLabel>
              <FormSelect value={apptType} onChange={(e) => setApptType(e.target.value)}>
                <option value="" disabled>
                  Select type
                </option>
                {types.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </FormSelect>
            </div>

            <div>
              <FormLabel required>Reason</FormLabel>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Brief reason"
                rows={3}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-body-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[88px]"
              />
            </div>

            <label className="flex items-start gap-2 text-body-sm cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={termsAgreed}
                onChange={(e) => setTermsAgreed(e.target.checked)}
                className="mt-1 rounded"
              />
              <span>I agree to clinic terms.</span>
            </label>

            <CareqButton
              type="button"
              className="w-full cursor-pointer"
              disabled={loading || !patientId || !apptType}
              onClick={walkInCheckin}
            >
              {loading ? "Checking in…" : "Check in"}
            </CareqButton>
          </div>
        )}
      </div>
    </CareqCard>
  );
}

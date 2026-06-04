"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
  const router = useRouter();
  const patientId = params.get("patientId");

  const [types, setTypes] = useState<ApptType[]>([]);
  const [apptType, setApptType] = useState("");
  const [ref, setRef] = useState("");
  const [refLookup, setRefLookup] = useState<AppointmentPreview | null>(null);
  const [refLookupError, setRefLookupError] = useState("");
  const [lookingUp, setLookingUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"appointment" | "walk-in">(
    patientId ? "walk-in" : "appointment"
  );

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
          setRefLookupError(
            "No appointment record found. Please check your reference number."
          );
        }
      } catch {
        setRefLookup(null);
        setRefLookupError("Unable to look up appointment. Please try again.");
      } finally {
        setLookingUp(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [ref]);

  async function walkInCheckin(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) {
      setError("Please register or search for a patient first");
      return;
    }
    setLoading(true);
    setError(null);
    const fd = new FormData(e.target as HTMLFormElement);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "walk-in",
        patientId,
        appointmentType: apptType,
        additionalinfo: fd.get("reason"),
        termsAgreement: "on",
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Check-in failed");
      return;
    }
    const qn = data.queueNumber ?? data.quenumber;
    router.push(`/status/${qn}`);
  }

  async function appointmentCheckin(e: React.FormEvent) {
    e.preventDefault();
    if (!refLookup) {
      setError("Please enter a valid appointment reference first");
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
    const qn = data.queueNumber ?? data.quenumber;
    router.push(`/status/${qn}`);
  }

  const tabClass = (tab: "appointment" | "walk-in") =>
    cn(
      "flex-1 py-3 text-body-sm font-medium transition-colors border-b-2",
      activeTab === tab
        ? "border-primary text-primary bg-card"
        : "border-transparent text-on-surface-variant hover:text-foreground bg-muted/40"
    );

  return (
    <CareqCard className="overflow-hidden max-w-lg">
      <div className="px-6 py-4 border-b border-border text-center">
        <h3 className="text-headline-sm text-foreground">Welcome to Our Clinic</h3>
        <p className="text-body-sm text-on-surface-variant mt-0.5">
          Please complete your check-in process
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
          title={!patientId ? "Search for your patient record first" : undefined}
        >
          Walk-In
          {!patientId && (
            <span className="block text-xs font-normal">
              (
              <Link href="/visit" className="text-primary hover:underline">
                find your record first
              </Link>
              )
            </span>
          )}
        </button>
      </div>

      <div className="px-6 py-5">
        {error && <FormError message={error} />}

        {activeTab === "appointment" && (
          <form onSubmit={appointmentCheckin} className="space-y-4">
            <div>
              <FormLabel required>Appointment Reference Number</FormLabel>
              <FormInput
                type="text"
                value={ref}
                onChange={(e) => setRef(e.target.value.toUpperCase())}
                required
                placeholder="e.g. APT20250630001"
                className="uppercase"
              />
              <p className="text-body-sm text-on-surface-variant mt-1">
                Find this on your appointment confirmation slip (it starts with{" "}
                <strong>APT</strong>). No slip?{" "}
                <Link href="/visit" className="text-primary hover:underline">
                  Walk in instead.
                </Link>
              </p>
              {lookingUp && (
                <p className="text-body-sm text-on-surface-variant mt-1">Looking up...</p>
              )}
              {refLookupError && !lookingUp && (
                <p className="text-body-sm text-destructive mt-1">{refLookupError}</p>
              )}
            </div>

            {refLookup && (
              <div className="rounded-lg border border-border p-4 text-body-sm space-y-2 bg-muted/30">
                <Row label="Patient" value={refLookup.fullname} />
                <Row label="Appointment" value={refLookup.appointment} />
                <Row label="Date" value={refLookup.appointment_date} />
                <Row label="Time" value={refLookup.time} />
                <Row label="Doctor" value={refLookup.doctor} />
                {refLookup.reason && <Row label="Reason" value={refLookup.reason} />}
              </div>
            )}

            <div className="text-center">
              <CareqButton type="submit" disabled={loading || !refLookup}>
                {loading ? "Checking in..." : "Check In"}
              </CareqButton>
            </div>
          </form>
        )}

        {activeTab === "walk-in" && (
          <form onSubmit={walkInCheckin} className="space-y-4">
            {!patientId && (
              <FormWarning>
                No patient selected.{" "}
                <Link href="/patient-search" className="text-primary hover:underline font-medium">
                  Search patient
                </Link>{" "}
                or{" "}
                <Link href="/registration" className="text-primary hover:underline font-medium">
                  register
                </Link>
                .
              </FormWarning>
            )}

            <div>
              <FormLabel required>Visit Type</FormLabel>
              <FormSelect
                value={apptType}
                onChange={(e) => setApptType(e.target.value)}
                required
              >
                <option value="" disabled>
                  Select visit type
                </option>
                {types.map((t) => (
                  <option key={t.id} value={String(t.id)}>
                    {t.name}
                  </option>
                ))}
              </FormSelect>
            </div>

            <div>
              <FormLabel required>Additional Information / Reason</FormLabel>
              <textarea
                name="reason"
                required
                placeholder="Brief description of your visit"
                rows={3}
                className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-body-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[88px]"
              />
            </div>

            <label className="flex items-start gap-2 text-body-sm cursor-pointer">
              <input type="checkbox" name="terms" required className="mt-1 rounded" />
              <span>I agree to the clinic terms and consent to treatment.</span>
            </label>

            <div className="text-center">
              <CareqButton type="submit" disabled={loading || !patientId || !apptType}>
                {loading ? "Checking in..." : "Complete Check-In"}
              </CareqButton>
            </div>
          </form>
        )}
      </div>
    </CareqCard>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-on-surface-variant">{label}:</span>
      <strong className="text-foreground text-right">{value}</strong>
    </div>
  );
}

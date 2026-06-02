"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

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

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors";

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
      .then((r) => r.json())
      .then((d) => setTypes(d.types ?? []));
  }, []);

  useEffect(() => {
    if (ref.length < 3) {
      setRefLookup(null);
      setRefLookupError("");
      return;
    }
    const t = setTimeout(async () => {
      setLookingUp(true);
      const res = await fetch(`/api/checkin?appointmentID=${encodeURIComponent(ref.toUpperCase())}`);
      const data = await res.json();
      setLookingUp(false);
      if (data.success && data.appointment?.[0]) {
        setRefLookup(data.appointment[0]);
        setRefLookupError("");
      } else {
        setRefLookup(null);
        setRefLookupError("No appointment record found. Please check your reference number.");
      }
    }, 500);
    return () => clearTimeout(t);
  }, [ref]);

  async function walkInCheckin(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) { setError("Please register or search for a patient first"); return; }
    setLoading(true);
    setError(null);
    const fd = new FormData(e.target as HTMLFormElement);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "walk-in", patientId, appointmentType: apptType, additionalinfo: fd.get("reason"), termsAgreement: "on" }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Check-in failed"); return; }
    const qn = data.queueNumber ?? data.quenumber;
    router.push(`/status/${qn}`);
  }

  async function appointmentCheckin(e: React.FormEvent) {
    e.preventDefault();
    if (!refLookup) { setError("Please enter a valid appointment reference first"); return; }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: refLookup.appnumber }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error ?? "Check-in failed"); return; }
    const qn = data.queueNumber ?? data.quenumber;
    router.push(`/status/${qn}`);
  }

  return (
    <div className="careq-card shadow overflow-hidden max-w-lg">
      {/* Card header */}
      <div className="px-6 py-4 bg-white border-b border-gray-100 text-center">
        <h3 className="text-xl font-semibold text-gray-800">Welcome to Our Clinic</h3>
        <p className="text-gray-500 text-sm mt-0.5">Please complete your check-in process</p>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        <button
          type="button"
          onClick={() => setActiveTab("appointment")}
          className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "appointment"
              ? "border-[#0d6efd] text-[#0d6efd] bg-white"
              : "border-transparent text-gray-500 hover:text-gray-700 bg-gray-50"
          }`}
        >
          Appointment
        </button>
        <button
          type="button"
          disabled={!patientId}
          onClick={() => patientId && setActiveTab("walk-in")}
          className={`flex-1 py-3 text-sm font-medium transition-colors border-b-2 ${
            activeTab === "walk-in"
              ? "border-[#0d6efd] text-[#0d6efd] bg-white"
              : !patientId
              ? "border-transparent text-gray-300 cursor-not-allowed bg-gray-50"
              : "border-transparent text-gray-500 hover:text-gray-700 bg-gray-50"
          }`}
          title={!patientId ? "Search for your patient record first" : undefined}
        >
          Walk-In
          {!patientId && (
            <span className="block text-xs font-normal text-gray-400">
              (<Link href="/visit" className="text-[#0d6efd] hover:underline">find your record first</Link>)
            </span>
          )}
        </button>
      </div>

      <div className="px-6 py-5">
        {error && (
          <div className="mb-4 p-3 rounded text-sm flex items-center gap-2" style={{ backgroundColor: "#f8d7da", color: "#842029", border: "1px solid #f5c2c7" }}>
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            {error}
          </div>
        )}

        {/* Appointment tab */}
        {activeTab === "appointment" && (
          <form onSubmit={appointmentCheckin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Appointment Reference Number
              </label>
              <input
                type="text"
                value={ref}
                onChange={(e) => setRef(e.target.value.toUpperCase())}
                required
                placeholder="e.g. APT20250630001"
                className={inputCls + " uppercase"}
              />
              <p className="text-xs text-gray-500 mt-1">
                Find this on your appointment confirmation slip (it starts with <strong>APT</strong>).
                No slip?{" "}
                <Link href="/visit" className="text-[#0d6efd] hover:underline">Walk in instead.</Link>
              </p>
              {lookingUp && <p className="text-sm text-gray-400 mt-1">Looking up...</p>}
              {refLookupError && !lookingUp && (
                <p className="text-sm text-red-600 mt-1">{refLookupError}</p>
              )}
            </div>

            {refLookup && (
              <div className="rounded-lg border border-gray-200 p-4 text-sm space-y-2 bg-gray-50">
                <div className="flex justify-between">
                  <span className="text-gray-500">Patient:</span>
                  <strong className="text-gray-800">{refLookup.fullname}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Appointment:</span>
                  <strong className="text-gray-800">{refLookup.appointment}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date:</span>
                  <strong className="text-gray-800">{refLookup.appointment_date}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Time:</span>
                  <strong className="text-gray-800">{refLookup.time}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Doctor:</span>
                  <strong className="text-gray-800">{refLookup.doctor}</strong>
                </div>
                {refLookup.reason && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Reason:</span>
                    <strong className="text-gray-800">{refLookup.reason}</strong>
                  </div>
                )}
              </div>
            )}

            <div className="text-center">
              <button
                type="submit"
                disabled={loading || !refLookup}
                className="bg-[#0d6efd] hover:bg-[#0b5ed7] disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
              >
                {loading ? "Checking in..." : "Check In"}
              </button>
            </div>
          </form>
        )}

        {/* Walk-in tab */}
        {activeTab === "walk-in" && (
          <form onSubmit={walkInCheckin} className="space-y-4">
            {!patientId && (
              <div className="p-3 rounded text-sm" style={{ backgroundColor: "#fff3cd", color: "#664d03", border: "1px solid #ffecb5" }}>
                No patient selected.{" "}
                <Link href="/patient-search" className="text-[#0d6efd] hover:underline">Search patient</Link>{" "}
                or{" "}
                <Link href="/registration" className="text-[#0d6efd] hover:underline">register</Link>.
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visit Type</label>
              <select
                value={apptType}
                onChange={(e) => setApptType(e.target.value)}
                required
                className={inputCls}
              >
                <option value="" disabled>Select visit type</option>
                {types.map((t) => (
                  <option key={t.id} value={String(t.id)}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Information / Reason
              </label>
              <textarea
                name="reason"
                required
                placeholder="Brief description of your visit"
                rows={3}
                className={inputCls + " resize-none"}
              />
            </div>

            <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
              <input type="checkbox" name="terms" required className="mt-0.5 rounded" />
              <span>I agree to the clinic terms and consent to treatment.</span>
            </label>

            <div className="text-center">
              <button
                type="submit"
                disabled={loading || !patientId || !apptType}
                className="bg-[#0d6efd] hover:bg-[#0b5ed7] disabled:bg-gray-400 text-white px-6 py-2.5 rounded-lg font-medium transition-colors"
              >
                {loading ? "Checking in..." : "Complete Check-In"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

export function RegistrationForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [matchedModal, setMatchedModal] = useState<{
    patientId: string;
    matchedBy: string;
    message: string;
  } | null>(null);
  const [successModal, setSuccessModal] = useState<{ patientId: string } | null>(null);
  const matchedModalRef = useFocusTrap(!!matchedModal, () => setMatchedModal(null));
  const successModalRef = useFocusTrap(!!successModal, () => setSuccessModal(null));

  function navigateAfterRegister(patientId: string) {
    if (redirectTo) {
      router.push(`${redirectTo}?patientId=${patientId}`);
    } else {
      router.push(`/checkin?patientId=${patientId}`);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);

    const phoneRaw = String(fd.get("phone") ?? "");
    const phoneDigits = phoneRaw.replace(/\D/g, "");
    if (phoneDigits.length !== 11) {
      setError("Phone number must be exactly 11 digits (e.g. 09XXXXXXXXX).");
      setLoading(false);
      return;
    }

    const dobRaw = String(fd.get("dob") ?? "");
    const dobYear = parseInt(dobRaw.slice(0, 4), 10);
    const currentYear = new Date().getFullYear();
    if (!dobRaw || isNaN(dobYear) || dobYear < 1900 || dobYear > currentYear) {
      setError(`Date of birth must be a valid date between 1900 and ${currentYear}.`);
      setLoading(false);
      return;
    }

    const res = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: fd.get("firstName"),
        lastName: fd.get("lastName"),
        dob: fd.get("dob"),
        gender,
        phone: phoneDigits,
        email: fd.get("email") || undefined,
        address: fd.get("address"),
        consent: fd.get("consent") === "on",
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Registration failed. Please try again.");
      return;
    }

    if (data.reused_existing) {
      setMatchedModal({
        patientId: String(data.patient),
        matchedBy: data.matched_by ?? "existing record",
        message: data.message ?? "We matched your details to an existing patient profile. No new record was created.",
      });
      return;
    }

    setSuccessModal({ patientId: String(data.patient) });
  }

  const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors";
  const labelCls = "block text-sm font-medium text-gray-700 mb-1";

  return (
    <>
      <div className="careq-card shadow">
        {/* Card header */}
        <div className="px-6 py-4 bg-white border-b border-gray-100">
          <h3 className="text-xl font-semibold text-gray-800">Patient Information</h3>
          <p className="text-gray-500 text-sm mt-0.5">Please fill out all required fields.</p>
          <p className="text-xs text-gray-400 mt-1">
            Been here before?{" "}
            <Link href="/patient-search" className="text-[#0d6efd] hover:underline">
              Find Patient
            </Link>{" "}
            first instead of registering again.
          </p>
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

          <form onSubmit={onSubmit}>
            {/* Name row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
              <div>
                <label htmlFor="firstName" className={labelCls}>
                  First Name <span className="text-red-500">*</span>
                </label>
                <input id="firstName" name="firstName" type="text" required className={inputCls} />
              </div>
              <div>
                <label htmlFor="lastName" className={labelCls}>
                  Last Name <span className="text-red-500">*</span>
                </label>
                <input id="lastName" name="lastName" type="text" required className={inputCls} />
              </div>
            </div>

            {/* DOB / Gender row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
              <div>
                <label htmlFor="dob" className={labelCls}>
                  Date of Birth <span className="text-red-500">*</span>
                </label>
                <input
                  id="dob"
                  name="dob"
                  type="date"
                  required
                  min="1900-01-01"
                  max={new Date().toISOString().slice(0, 10)}
                  className={inputCls}
                />
              </div>
              <div>
                <label htmlFor="gender" className={labelCls}>
                  Gender <span className="text-red-500">*</span>
                </label>
                <select
                  id="gender"
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  required
                  className={inputCls}
                >
                  <option value="" disabled>Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer-not-to-say">Prefer not to say</option>
                </select>
                <input type="hidden" name="gender" value={gender} />
              </div>
            </div>

            {/* Phone */}
            <div className="mb-3">
              <label htmlFor="phone" className={labelCls}>
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="09XXXXXXXXX"
                maxLength={11}
                inputMode="numeric"
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.value = t.value.replace(/\D/g, "").slice(0, 11);
                }}
                className={inputCls}
              />
            </div>

            {/* Email */}
            <div className="mb-3">
              <label htmlFor="email" className={labelCls}>
                Email <span className="text-gray-400 font-normal text-xs">(optional)</span>
              </label>
              <input id="email" name="email" type="email" placeholder="you@example.com" autoComplete="email" className={inputCls} />
            </div>

            {/* Address */}
            <div className="mb-4">
              <label htmlFor="address" className={labelCls}>
                Area <span className="text-red-500">*</span>
              </label>
              <input id="address" name="address" type="text" required maxLength={100} className={inputCls} />
            </div>

            {/* Consent */}
            <div className="mb-5">
              <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" name="consent" required className="mt-0.5 rounded" />
                <span>
                  I consent to the storage and processing of my personal data.{" "}
                  <span className="text-red-500">*</span>
                </span>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex flex-wrap gap-3 justify-end">
              <button
                type="button"
                onClick={() => router.push("/visit")}
                className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || !gender}
                className="bg-[#0d6efd] hover:bg-[#0b5ed7] disabled:bg-gray-400 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {loading ? "Registering..." : "Complete Registration and Check In"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Profile match modal */}
      {matchedModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div ref={matchedModalRef} role="dialog" aria-modal="true" aria-labelledby="matched-modal-title" className="bg-white rounded-xl max-w-md w-full shadow-xl overflow-hidden" style={{ border: "2px solid #0d6efd" }}>
            <div className="px-5 py-4 flex items-center gap-2" style={{ backgroundColor: "rgba(13,110,253,0.08)" }}>
              <svg className="w-5 h-5 text-[#0d6efd]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <h5 id="matched-modal-title" className="font-bold text-gray-800">Profile already on file</h5>
            </div>
            <div className="px-5 py-4">
              <p className="text-sm text-gray-600 mb-2">{matchedModal.message}</p>
              <p className="text-xs text-gray-400">
                <strong>Patient ID:</strong> {matchedModal.patientId} &nbsp;·&nbsp;
                Matched by: {matchedModal.matchedBy}
              </p>
            </div>
            <div className="px-5 pb-4 flex flex-wrap gap-2 justify-between">
              <Link href="/patient-search" className="border border-gray-300 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded text-sm transition-colors">
                Find Patient
              </Link>
              <div className="flex gap-2">
                <button
                  onClick={() => router.push(`/appointments?patientId=${matchedModal.patientId}`)}
                  className="border border-[#0d6efd] text-[#0d6efd] hover:bg-[#0d6efd] hover:text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                >
                  Book Appointment
                </button>
                <button
                  onClick={() => navigateAfterRegister(matchedModal.patientId)}
                  className="bg-[#0d6efd] hover:bg-[#0b5ed7] text-white px-3 py-1.5 rounded text-sm font-medium transition-colors"
                >
                  Check In Today
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Registration success modal */}
      {successModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div ref={successModalRef} role="dialog" aria-modal="true" aria-labelledby="success-modal-title" className="bg-white rounded-xl max-w-md w-full shadow-xl overflow-hidden">
            <div className="px-5 pt-4 pb-0 flex justify-end">
              <button onClick={() => setSuccessModal(null)} aria-label="Close" className="text-gray-400 hover:text-gray-600">
                <svg aria-hidden="true" className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-center px-6 py-4">
              <div className="icon-circle bg-green-100 text-green-600 mx-auto mb-3">
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h4 id="success-modal-title" className="text-xl font-bold text-gray-800 mb-1">Registration Complete!</h4>
              <p className="text-gray-500 text-sm mb-4">Thank you for registering with our clinic.</p>
              <div className="text-left p-3 rounded-lg text-sm mb-2" style={{ backgroundColor: "#d1ecf1", color: "#0c5460", border: "1px solid #bee5eb" }}>
                <p className="font-semibold mb-1">
                  <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Next Steps
                </p>
                <p><strong>Check In Today</strong> if you are here right now for a walk-in visit.</p>
                <p className="mt-1"><strong>Book Appointment</strong> to schedule a future visit.</p>
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-3 justify-center">
              <button
                onClick={() => router.push(`/appointments?patientId=${successModal.patientId}`)}
                className="border border-[#0d6efd] text-[#0d6efd] hover:bg-[#0d6efd] hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Book Appointment
              </button>
              <button
                onClick={() => navigateAfterRegister(successModal.patientId)}
                className="bg-[#0d6efd] hover:bg-[#0b5ed7] text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Check In Today
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

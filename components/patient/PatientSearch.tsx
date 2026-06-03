"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useFocusTrap } from "@/lib/hooks/useFocusTrap";

type Patient = {
  id: string;
  first_name: string;
  last_name: string;
  dob: string;
  phone: string;
  gender: string;
  address: string;
  created_at: string;
};

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors";

export function PatientSearch() {
  const router = useRouter();
  const [term, setTerm] = useState("");
  const [dob, setDob] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [verifyModal, setVerifyModal] = useState<{
    patient: Patient;
    destination: "appointments" | "checkin";
  } | null>(null);
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const verifyModalRef = useFocusTrap(!!verifyModal, () => setVerifyModal(null));

  async function search(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (term.trim().length < 2) return;
    setLoading(true);
    setSearched(false);
    try {
      const params = new URLSearchParams({ term: term.trim() });
      if (dob) params.set("dob", dob);
      const res = await fetch(`/api/patients?${params}`);
      const data = res.ok ? await res.json() : { patients: [] };
      setPatients(data.patients ?? []);
    } catch {
      setPatients([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  function navigate(patient: Patient, destination: "appointments" | "checkin") {
    if (patients.length > 1) {
      setVerifyModal({ patient, destination });
      setVerifyInput("");
      setVerifyError("");
      return;
    }
    goTo(patient, destination);
  }

  function goTo(patient: Patient, destination: "appointments" | "checkin") {
    if (destination === "appointments") {
      router.push(`/appointments?patientId=${patient.id}`);
    } else {
      router.push(`/checkin?patientId=${patient.id}`);
    }
  }

  function handleVerify() {
    if (!verifyModal) return;
    const phone = verifyModal.patient.phone.replace(/\D/g, "");
    const last4 = phone.slice(-4);
    if (verifyInput.trim() !== last4) {
      setVerifyError("The last 4 digits do not match. Please try again.");
      return;
    }
    setVerifyModal(null);
    goTo(verifyModal.patient, verifyModal.destination);
  }

  return (
    <>
      <div className="careq-card shadow max-w-2xl">
        {/* Card header */}
        <div className="px-6 py-4 bg-white border-b border-gray-100">
          <h3 className="text-xl font-semibold text-gray-800">Find Patient</h3>
          <p className="text-gray-500 text-sm mt-0.5">Search by name or phone number</p>
        </div>

        <div className="px-6 py-5">
          <form onSubmit={search}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Term</label>
                <input
                  type="text"
                  placeholder="Name or phone number"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  required
                  minLength={2}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loading || term.trim().length < 2}
              className="w-full flex items-center justify-center gap-2 bg-[#0d6efd] hover:bg-[#0b5ed7] disabled:bg-gray-400 text-white font-medium px-4 py-2.5 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              {loading ? "Searching..." : "Search Patient"}
            </button>
          </form>

          {/* Search results */}
          {searched && (
            <div className="mt-5">
              <h5 className="font-semibold text-gray-800 mb-3">Search Results</h5>

              {patients.length > 1 && (
                <div className="p-3 rounded text-sm mb-3 flex items-start gap-2" style={{ backgroundColor: "#cff4fc", color: "#055160", border: "1px solid #b6effb" }}>
                  <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Multiple records matched. Booking or check-in will ask for the <strong>last 4 digits</strong> of the selected patient&apos;s phone number.
                </div>
              )}

              {patients.length === 0 ? (
                <div className="p-3 rounded text-sm flex items-center gap-2" style={{ backgroundColor: "#fff3cd", color: "#664d03", border: "1px solid #ffecb5" }}>
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  No patients found.{" "}
                  <Link href="/registration" className="text-[#0d6efd] hover:underline font-medium">
                    Register new patient
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {patients.map((p) => (
                    <div key={p.id} className="careq-card border border-gray-100 p-4 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800">
                          {p.first_name} {p.last_name}
                        </p>
                        <p className="text-sm text-gray-500">
                          DOB: {p.dob} &nbsp;·&nbsp; {p.gender}
                        </p>
                        <p className="text-sm text-gray-500">
                          {p.phone} &nbsp;·&nbsp; {p.address}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
                        <button
                          onClick={() => navigate(p, "appointments")}
                          className="flex-1 sm:flex-none text-sm border border-[#0d6efd] text-[#0d6efd] hover:bg-[#0d6efd] hover:text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          Book Appointment
                        </button>
                        <button
                          onClick={() => navigate(p, "checkin")}
                          className="flex-1 sm:flex-none text-sm bg-[#0d6efd] hover:bg-[#0b5ed7] text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
                        >
                          Check In
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <p className="mt-3 text-sm text-gray-500">
        New patient?{" "}
        <Link href="/registration" className="text-[#0d6efd] hover:underline">
          Register here
        </Link>
      </p>

      {/* Phone verification modal */}
      {verifyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div ref={verifyModalRef} role="dialog" aria-modal="true" aria-labelledby="verify-modal-title" className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h5 id="verify-modal-title" className="font-bold text-gray-800 mb-3">Verify Identity</h5>
            <p className="text-sm text-gray-600 mb-4">
              Multiple matches found. Enter the last <strong>4 digits</strong> of{" "}
              <strong>{verifyModal.patient.first_name} {verifyModal.patient.last_name}&apos;s</strong> phone number to confirm.
            </p>
            <input
              type="text"
              placeholder="Last 4 digits"
              maxLength={4}
              value={verifyInput}
              inputMode="numeric"
              onChange={(e) => { setVerifyInput(e.target.value.replace(/\D/g, "")); setVerifyError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleVerify()}
              className={inputCls + " text-center text-lg tracking-widest"}
            />
            {verifyError && (
              <p className="text-red-600 text-sm mt-2">{verifyError}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleVerify}
                disabled={verifyInput.length !== 4}
                className="flex-1 bg-[#0d6efd] hover:bg-[#0b5ed7] disabled:bg-gray-400 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setVerifyModal(null)}
                className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

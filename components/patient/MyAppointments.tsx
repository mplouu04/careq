"use client";

import { useState } from "react";
import { toast } from "sonner";

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors";

type Appointment = {
  checkinId: string;
  reference: string;
  date: string;
  time: string;
  doctor: string;
  type: string;
  reason: string;
  status: string;
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  checked_in: "Confirmed",
  cancelled: "Cancelled",
  no_show: "No Show",
  in_progress: "In Progress",
  completed: "Completed",
};

const TERMINAL_STATUSES = ["cancelled", "completed", "no_show"];

export function MyAppointments() {
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patientName, setPatientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  // Cancel confirm modal
  const [cancelRef, setCancelRef] = useState<string | null>(null);

  async function lookup() {
    if (!phone || !dob) {
      toast.error("Please enter both phone number and date of birth.");
      return;
    }
    setLoading(true);
    const res = await fetch(
      `/api/appointments?phone=${encodeURIComponent(phone)}&dob=${dob}`
    );
    const data = await res.json();
    setAppointments(data.appointments ?? []);
    setPatientName(data.patientName ?? "");
    setLoading(false);
    setSearched(true);
  }

  async function confirmCancel(ref: string) {
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", reference: ref, phone }),
    });
    const data = await res.json();
    setCancelRef(null);
    if (!res.ok) {
      toast.error(data.error ?? "Cancel failed");
      return;
    }
    toast.success("Appointment cancelled.");
    // Refresh list
    await lookup();
  }

  const statusColors: Record<string, string> = {
    pending: "bg-blue-100 text-blue-700",
    checked_in: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-700",
    no_show: "bg-gray-100 text-gray-600",
    in_progress: "bg-yellow-100 text-yellow-700",
    completed: "bg-gray-100 text-gray-600",
  };

  return (
    <div className="space-y-5 max-w-xl">
      {/* Search form */}
      <div className="careq-card shadow">
        <div className="px-6 py-4 bg-white border-b border-gray-100">
          <h3 className="text-xl font-semibold text-gray-800">Look Up Appointments</h3>
          <p className="text-gray-500 text-sm mt-0.5">Enter your phone and date of birth</p>
        </div>
        <div className="px-6 py-5">
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="09XXXXXXXXX"
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
            onClick={lookup}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 bg-[#0d6efd] hover:bg-[#0b5ed7] disabled:bg-gray-400 text-white font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            {loading ? "Looking up..." : "Look Up Appointments"}
          </button>
        </div>
      </div>

      {searched && (
        <>
          {patientName && (
            <p className="font-medium text-lg text-gray-800">
              Hello, <strong>{patientName}</strong>!
            </p>
          )}
          {appointments.length === 0 && (
            <p className="text-gray-500 text-sm">No upcoming appointments found.</p>
          )}
          <div className="space-y-3">
            {appointments.map((a) => (
              <div key={a.checkinId} className="careq-card p-4 space-y-2">
                <div className="flex justify-between items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-800 truncate">{a.reference}</p>
                    <p className="text-sm text-gray-500">{a.doctor} — {a.type}</p>
                    <p className="text-sm text-gray-700">{a.date} at {a.time}</p>
                    {a.reason && <p className="text-sm text-gray-400">Reason: {a.reason}</p>}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full flex-shrink-0 ${statusColors[a.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[a.status] ?? a.status}
                  </span>
                </div>
                {!TERMINAL_STATUSES.includes(a.status) && (
                  <button
                    onClick={() => setCancelRef(a.reference)}
                    className="text-sm border border-red-300 text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg font-medium transition-colors"
                  >
                    Cancel Appointment
                  </button>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Cancel confirmation modal */}
      {cancelRef && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl">
            <h5 className="font-bold text-gray-800 mb-3">Cancel Appointment</h5>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to cancel appointment{" "}
              <strong>{cancelRef}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => confirmCancel(cancelRef)}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Yes, Cancel
              </button>
              <button
                onClick={() => setCancelRef(null)}
                className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 py-2 rounded-lg font-medium transition-colors"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

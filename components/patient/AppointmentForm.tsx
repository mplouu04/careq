"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { format, addDays, getDay } from "date-fns";

type Doctor = { id: string; first_name: string; last_name: string };
type ApptType = { id: string; name: string; duration: number };

function formatTime12h(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${mStr ?? "00"} ${ampm}`;
}

function isWeekend(dateStr: string): boolean {
  const day = getDay(new Date(dateStr + "T00:00:00"));
  return day === 0 || day === 6;
}

const inputCls = "w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-colors";

export function AppointmentForm() {
  const params = useSearchParams();
  const patientId = params.get("patientId");

  const today = format(new Date(), "yyyy-MM-dd");
  const maxDate = format(addDays(new Date(), 30), "yyyy-MM-dd");

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [types, setTypes] = useState<ApptType[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [appTypeId, setAppTypeId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<{
    appointmentID: string;
    date: string;
    time: string;
    doctor: string;
    type: string;
  } | null>(null);

  useEffect(() => {
    fetch("/api/doctors")
      .then((r) => r.json())
      .then((d) => setDoctors(d.doctors ?? []));
    fetch("/api/appointment-types")
      .then((r) => r.json())
      .then((d) => setTypes(d.types ?? []));
  }, []);

  useEffect(() => {
    if (!doctorId || !date) { setSlots([]); setTime(""); return; }
    fetch(`/api/doctors/availability?doctorId=${doctorId}&date=${date}`)
      .then((r) => r.json())
      .then((d) => { setSlots(d.available_slots ?? d.slots ?? []); setTime(""); });
  }, [doctorId, date]);

  function handleDateChange(val: string) {
    if (isWeekend(val)) {
      toast.error("Appointments are only available on weekdays (Mon–Fri).");
      return;
    }
    setDate(val);
  }

  async function book(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!patientId) { toast.error("Select a patient first via patient search"); return; }
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferredDoctor: doctorId,
        appointmentType: appTypeId,
        appointmentDate: date,
        appointmentTime: time,
        termsAgreement: "on",
        reason: fd.get("reason"),
        patient_id: patientId,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { toast.error(data.error ?? "Booking failed"); return; }

    const doctor = doctors.find((d) => d.id === doctorId);
    const apptType = types.find((t) => String(t.id) === appTypeId);
    setSuccess({
      appointmentID: data.appointmentID,
      date,
      time: formatTime12h(time),
      doctor: doctor ? `Dr. ${doctor.first_name} ${doctor.last_name}` : "",
      type: apptType?.name ?? "",
    });
  }

  if (success) {
    return (
      <div className="careq-card shadow overflow-hidden">
        <div className="px-6 py-5 text-center" style={{ backgroundColor: "rgba(25,135,84,0.08)" }}>
          <div className="icon-circle mx-auto mb-3" style={{ backgroundColor: "#d1e7dd", color: "#198754" }}>
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h4 className="text-xl font-bold text-gray-800 mb-1">Appointment Confirmed!</h4>
          <p className="text-gray-500 text-sm">Your appointment has been successfully booked.</p>
        </div>
        <div className="px-6 py-4 space-y-2 text-sm">
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-500">Reference:</span>
            <strong className="text-gray-800 font-mono">{success.appointmentID}</strong>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-500">Date:</span>
            <strong className="text-gray-800">{success.date}</strong>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-500">Time:</span>
            <strong className="text-gray-800">{success.time}</strong>
          </div>
          <div className="flex justify-between border-b border-gray-100 pb-2">
            <span className="text-gray-500">Doctor:</span>
            <strong className="text-gray-800">{success.doctor}</strong>
          </div>
          <div className="flex justify-between pb-2">
            <span className="text-gray-500">Type:</span>
            <strong className="text-gray-800">{success.type}</strong>
          </div>
        </div>
        <div className="px-6 pb-5">
          <div className="p-3 rounded text-sm mb-4" style={{ backgroundColor: "#d1ecf1", color: "#0c5460", border: "1px solid #bee5eb" }}>
            <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Save this reference number. You&apos;ll need it for check-in on your visit day.
          </div>
          <div className="flex gap-3">
            <button onClick={() => window.print()} className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
              </svg>
              Print
            </button>
            <button onClick={() => (window.location.href = "/")} className="flex-1 bg-[#0d6efd] hover:bg-[#0b5ed7] text-white py-2 rounded-lg text-sm font-medium transition-colors">
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="careq-card shadow overflow-hidden">
      <div className="px-6 py-4 bg-white border-b border-gray-100">
        <h3 className="text-xl font-semibold text-gray-800">Book an Appointment</h3>
        <p className="text-gray-500 text-sm mt-0.5">Fill in the details below to schedule your visit.</p>
      </div>
      <div className="px-6 py-5">
        {!patientId && (
          <div className="mb-4 p-3 rounded text-sm" style={{ backgroundColor: "#fff3cd", color: "#664d03", border: "1px solid #ffecb5" }}>
            <Link href="/patient-search" className="text-[#0d6efd] hover:underline font-medium">Find a patient</Link>{" "}
            before booking.
          </div>
        )}

        <form onSubmit={book} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Preferred Doctor</label>
            <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} className={inputCls}>
              <option value="">Select doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Type</label>
            <select value={appTypeId} onChange={(e) => setAppTypeId(e.target.value)} className={inputCls}>
              <option value="">Select type</option>
              {types.map((t) => (
                <option key={t.id} value={String(t.id)}>{t.name} ({t.duration} min)</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Appointment Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              required
              min={today}
              max={maxDate}
              className={inputCls}
            />
            <p className="text-xs text-gray-400 mt-1">Weekdays only &bull; Up to 30 days in advance</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Slot</label>
            <select
              value={time}
              onChange={(e) => setTime(e.target.value)}
              disabled={slots.length === 0}
              required
              className={inputCls}
            >
              <option value="">
                {!doctorId || !date ? "Select doctor and date first" : slots.length ? "Select time" : "No slots available"}
              </option>
              {slots.map((s) => (
                <option key={s} value={s}>{formatTime12h(s)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason (optional)</label>
            <textarea name="reason" placeholder="Brief reason for the visit" rows={3} className={inputCls + " resize-none"} />
          </div>

          <label className="flex items-start gap-2 text-sm text-gray-700 cursor-pointer">
            <input type="checkbox" name="termsAgreement" required className="mt-0.5 rounded" />
            <span>I agree to the clinic terms and consent to this appointment.</span>
          </label>

          <button
            type="submit"
            disabled={loading || !patientId || !doctorId || !appTypeId || !date || !time}
            className="w-full bg-[#0d6efd] hover:bg-[#0b5ed7] disabled:bg-gray-400 text-white py-3 rounded-lg font-medium transition-colors"
          >
            {loading ? "Booking..." : "Book Appointment"}
          </button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { format, addDays, getDay } from "date-fns";
import { getClinicTodayYmd } from "@/lib/datetime";
import {
  CareqCard,
  CareqButton,
  CareqCardHeader,
  FormLabel,
  FormInput,
  FormSelect,
  SuccessCard,
} from "@/components/careq";
import { Skeleton } from "@/components/ui/skeleton";
import { AppointmentSummary } from "@/components/patient/AppointmentSummary";
import { PatientLookupInline } from "@/components/patient/PatientLookupInline";

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

export function AppointmentForm() {
  const params = useSearchParams();
  const publicId = params.get("publicId");

  const [today, setToday] = useState("");
  const [maxDate, setMaxDate] = useState("");

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [types, setTypes] = useState<ApptType[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [appTypeId, setAppTypeId] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [termsAgreed, setTermsAgreed] = useState(false);
  const [successRef, setSuccessRef] = useState<string | null>(null);

  useEffect(() => {
    const clinicToday = getClinicTodayYmd();
    setToday(clinicToday);
    setMaxDate(format(addDays(new Date(`${clinicToday}T12:00:00`), 30), "yyyy-MM-dd"));
    fetch("/api/doctors")
      .then((r) => (r.ok ? r.json() : { doctors: [] }))
      .then((d) => setDoctors(d.doctors ?? []))
      .catch(() => {});
    fetch("/api/appointment-types")
      .then((r) => (r.ok ? r.json() : { types: [] }))
      .then((d) => setTypes(d.types ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!doctorId || !date) {
      setSlots([]);
      setTime("");
      return;
    }
    const type = types.find((t) => String(t.id) === appTypeId);
    const duration = type?.duration ?? 30;
    const params = new URLSearchParams({
      doctorId,
      date,
      durationMinutes: String(duration),
    });
    setSlotsLoading(true);
    fetch(`/api/doctors/availability?${params}`)
      .then((r) => (r.ok ? r.json() : { available_slots: [] }))
      .then((d) => {
        setSlots(d.available_slots ?? d.slots ?? []);
        setTime("");
        if (d.no_schedule && (d.available_slots ?? []).length === 0) {
          toast.error("No availability — doctor schedule may not be configured for this day.");
        }
      })
      .catch(() => setSlots([]))
      .finally(() => setSlotsLoading(false));
  }, [doctorId, date, appTypeId, types]);

  function handleDateChange(val: string) {
    if (isWeekend(val)) {
      toast.error("Appointments are only available on weekdays (Mon–Fri).");
      return;
    }
    setDate(val);
  }

  async function book() {
    if (!publicId) {
      toast.error("Select a patient first via patient search");
      return;
    }
    if (!termsAgreed) {
      toast.error("Agree to clinic terms to continue.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        preferredDoctor: doctorId,
        appointmentType: appTypeId,
        appointmentDate: date,
        appointmentTime: time,
        termsAgreement: "on",
        reason,
        patient_id: publicId,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error ?? "Booking failed");
      return;
    }

    setSuccessRef(data.appointmentID);
  }

  if (successRef) {
    return (
      <SuccessCard
        reference={successRef}
        message="Appointment booked."
        primaryCta={{ label: "Track appointment", href: "/my-appointments" }}
        secondaryCta={{ label: "Book another", href: "/appointments" }}
      />
    );
  }

  const doctor = doctors.find((d) => d.id === doctorId);
  const apptType = types.find((t) => String(t.id) === appTypeId);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl">
      <CareqCard className="overflow-hidden lg:col-span-7">
        <CareqCardHeader
          title="Book an appointment"
          description="Choose your doctor, type, and an available time slot."
        />
        <div className="px-6 py-5">
          {!publicId && <PatientLookupInline />}

          <div className="space-y-4">
          <div>
            <FormLabel required>Preferred Doctor</FormLabel>
            <FormSelect value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
              <option value="">Select doctor</option>
              {doctors.map((d) => (
                <option key={d.id} value={d.id}>
                  Dr. {d.first_name} {d.last_name}
                </option>
              ))}
            </FormSelect>
          </div>

          <div>
            <FormLabel required>Appointment Type</FormLabel>
            <FormSelect value={appTypeId} onChange={(e) => setAppTypeId(e.target.value)} required>
              <option value="">Select type</option>
              {types.map((t) => (
                <option key={t.id} value={String(t.id)}>
                  {t.name} ({t.duration} min)
                </option>
              ))}
            </FormSelect>
          </div>

          <div>
            <FormLabel required>Appointment Date</FormLabel>
            <FormInput
              type="date"
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              required
              min={today}
              max={maxDate}
            />
            <p className="text-body-sm text-on-surface-variant mt-1">
              Weekdays only · Up to 30 days in advance
            </p>
          </div>

          <div>
            <FormLabel required>Time slot</FormLabel>
            {slotsLoading ? (
              <Skeleton className="h-10 w-full" aria-label="Loading time slots" />
            ) : (
              <FormSelect
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={slots.length === 0}
                required
              >
                <option value="">
                  {!doctorId || !date
                    ? "Select doctor and date first"
                    : slots.length
                      ? "Select time"
                      : "No slots available"}
                </option>
                {slots.map((s) => (
                  <option key={s} value={s}>
                    {formatTime12h(s)}
                  </option>
                ))}
              </FormSelect>
            )}
          </div>

          <div>
            <FormLabel>Reason (optional)</FormLabel>
            <textarea
              placeholder="Brief reason for the visit"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-body-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[88px]"
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
            disabled={loading || !publicId || !doctorId || !appTypeId || !date || !time}
            onClick={book}
          >
            {loading ? "Booking..." : "Book Appointment"}
          </CareqButton>
          </div>
        </div>
      </CareqCard>

      <div className="lg:col-span-5">
        <AppointmentSummary
          doctorLabel={doctor ? `Dr. ${doctor.first_name} ${doctor.last_name}` : ""}
          typeLabel={apptType?.name ?? ""}
          date={date}
          time={time}
          reason={reason}
        />
      </div>
    </div>
  );
}


"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { format, addDays, getDay } from "date-fns";
import { CheckCircle2, Printer } from "lucide-react";
import {
  CareqCard,
  CareqButton,
  CareqCardHeader,
  FormLabel,
  FormInput,
  FormSelect,
  FormWarning,
  FormInfo,
} from "@/components/careq";
import { Button } from "@/components/ui/button";

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
  const patientId = params.get("patientId");

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
  const [success, setSuccess] = useState<{
    appointmentID: string;
    date: string;
    time: string;
    doctor: string;
    type: string;
  } | null>(null);

  useEffect(() => {
    setToday(format(new Date(), "yyyy-MM-dd"));
    setMaxDate(format(addDays(new Date(), 30), "yyyy-MM-dd"));
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
    fetch(`/api/doctors/availability?doctorId=${doctorId}&date=${date}`)
      .then((r) => (r.ok ? r.json() : { available_slots: [] }))
      .then((d) => {
        setSlots(d.available_slots ?? d.slots ?? []);
        setTime("");
      })
      .catch(() => setSlots([]));
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
    if (!patientId) {
      toast.error("Select a patient first via patient search");
      return;
    }
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
    if (!res.ok) {
      toast.error(data.error ?? "Booking failed");
      return;
    }

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
      <CareqCard className="overflow-hidden">
        <div className="px-6 py-8 text-center bg-status-called/10">
          <div className="icon-circle bg-status-called/15 text-status-called mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <h4 className="text-headline-sm text-foreground mb-1">Appointment Confirmed!</h4>
          <p className="text-body-sm text-muted-foreground">
            Your appointment has been successfully booked.
          </p>
        </div>
        <div className="px-6 py-4 space-y-2 text-body-sm">
          <DetailRow label="Reference" value={success.appointmentID} mono />
          <DetailRow label="Date" value={success.date} />
          <DetailRow label="Time" value={success.time} />
          <DetailRow label="Doctor" value={success.doctor} />
          <DetailRow label="Type" value={success.type} />
        </div>
        <div className="px-6 pb-6">
          <FormInfo message="Save this reference number. You'll need it for check-in on your visit day." />
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" />
              Print
            </Button>
            <CareqButton className="flex-1" onClick={() => (window.location.href = "/")}>
              Done
            </CareqButton>
          </div>
        </div>
      </CareqCard>
    );
  }

  return (
    <CareqCard className="overflow-hidden">
      <CareqCardHeader
        title="Book an Appointment"
        description="Fill in the details below to schedule your visit."
      />
      <div className="px-6 py-5">
        {!patientId && (
          <FormWarning>
            <Link href="/patient-search" className="text-primary hover:underline font-medium">
              Find a patient
            </Link>{" "}
            before booking.
          </FormWarning>
        )}

        <form onSubmit={book} className="space-y-4">
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
            <p className="text-body-sm text-muted-foreground mt-1">
              Weekdays only · Up to 30 days in advance
            </p>
          </div>

          <div>
            <FormLabel required>Time Slot</FormLabel>
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
          </div>

          <div>
            <FormLabel>Reason (optional)</FormLabel>
            <textarea
              name="reason"
              placeholder="Brief reason for the visit"
              rows={3}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-body-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[88px]"
            />
          </div>

          <label className="flex items-start gap-2 text-body-sm cursor-pointer">
            <input type="checkbox" name="termsAgreement" required className="mt-1 rounded" />
            <span>I agree to the clinic terms and consent to this appointment.</span>
          </label>

          <CareqButton
            type="submit"
            className="w-full"
            disabled={loading || !patientId || !doctorId || !appTypeId || !date || !time}
          >
            {loading ? "Booking..." : "Book Appointment"}
          </CareqButton>
        </form>
      </div>
    </CareqCard>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between border-b border-border pb-2 last:border-0">
      <span className="text-muted-foreground">{label}:</span>
      <strong className={mono ? "font-mono text-foreground" : "text-foreground"}>{value}</strong>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";

type Doctor = { id: string; first_name: string; last_name: string };
type ApptType = { id: number; name: string; duration: number };

export function AppointmentForm() {
  const params = useSearchParams();
  const patientId = params.get("patientId");

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [types, setTypes] = useState<ApptType[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [appTypeId, setAppTypeId] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [slots, setSlots] = useState<string[]>([]);
  const [time, setTime] = useState("");
  const [loading, setLoading] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/doctors")
      .then((r) => r.json())
      .then((d) => setDoctors(d.doctors ?? []));
    fetch("/api/appointment-types")
      .then((r) => r.json())
      .then((d) => setTypes(d.types ?? []));
  }, []);

  useEffect(() => {
    if (!doctorId || !appTypeId || !date) return;
    const duration = types.find((t) => String(t.id) === appTypeId)?.duration ?? 15;
    fetch(
      `/api/doctors/availability?doctorId=${doctorId}&date=${date}&duration=${duration}`
    )
      .then((r) => r.json())
      .then((d) => setSlots(d.slots ?? []));
  }, [doctorId, appTypeId, date, types]);

  async function book(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) {
      toast.error("Select a patient first via patient search");
      return;
    }
    setLoading(true);
    const fd = new FormData(e.target as HTMLFormElement);
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        patientId: Number(patientId),
        doctorId,
        appTypeId: Number(appTypeId),
        date,
        time,
        reason: fd.get("reason"),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error ?? "Booking failed");
      return;
    }
    setReference(data.reference);
    toast.success("Appointment booked!");
  }

  if (reference) {
    return (
      <div className="rounded-lg border bg-green-50 p-6 space-y-2">
        <p className="font-semibold text-green-800">Appointment confirmed!</p>
        <p>
          Reference: <strong>{reference}</strong>
        </p>
        <p className="text-sm text-muted-foreground">
          Save this reference for check-in on your visit day.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={book} className="space-y-4 max-w-md">
      {!patientId && (
        <p className="text-amber-600 text-sm">
          <a href="/patient-search" className="underline">
            Find a patient
          </a>{" "}
          before booking.
        </p>
      )}
      <div>
        <Label>Doctor</Label>
        <Select value={doctorId} onValueChange={(v) => setDoctorId(v ?? "")} required>
          <SelectTrigger>
            <SelectValue placeholder="Select doctor" />
          </SelectTrigger>
          <SelectContent>
            {doctors.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                Dr. {d.first_name} {d.last_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Appointment Type</Label>
        <Select value={appTypeId} onValueChange={(v) => setAppTypeId(v ?? "")} required>
          <SelectTrigger>
            <SelectValue placeholder="Select type" />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name} ({t.duration} min)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Date</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required min={format(new Date(), "yyyy-MM-dd")} />
      </div>
      <div>
        <Label>Time Slot</Label>
        <Select value={time} onValueChange={(v) => setTime(v ?? "")} required>
          <SelectTrigger>
            <SelectValue placeholder={slots.length ? "Select time" : "No slots available"} />
          </SelectTrigger>
          <SelectContent>
            {slots.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Reason (optional)</Label>
        <Textarea name="reason" />
      </div>
      <Button type="submit" disabled={loading || !patientId} className="w-full">
        {loading ? "Booking..." : "Book Appointment"}
      </Button>
    </form>
  );
}

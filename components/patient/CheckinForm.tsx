"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

type ApptType = { id: number; name: string };

export function CheckinForm() {
  const params = useSearchParams();
  const router = useRouter();
  const type = params.get("type") ?? "walk-in";
  const patientId = params.get("patientId");

  const [types, setTypes] = useState<ApptType[]>([]);
  const [apptType, setApptType] = useState("");
  const [ref, setRef] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/appointment-types")
      .then((r) => r.json())
      .then((d) => setTypes(d.types ?? []));
  }, []);

  async function walkInCheckin(e: React.FormEvent) {
    e.preventDefault();
    if (!patientId) {
      toast.error("Please register or search for a patient first");
      return;
    }
    setLoading(true);
    const fd = new FormData(e.target as HTMLFormElement);
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "walk-in",
        patientId: Number(patientId),
        appointmentType: Number(apptType),
        additionalinfo: fd.get("reason"),
        termsAgreement: true,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error ?? "Check-in failed");
      return;
    }
    toast.success(`Checked in! Queue #${data.queueNumber}`);
    router.push(`/status/${data.queueNumber}`);
  }

  async function appointmentCheckin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const lookup = await fetch(`/api/checkin?reference=${encodeURIComponent(ref)}`);
    const lookupData = await lookup.json();
    if (!lookupData.appointment) {
      setLoading(false);
      toast.error("Appointment not found");
      return;
    }
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ appointmentId: lookupData.appointment.checkin_id }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      toast.error(data.error ?? "Check-in failed");
      return;
    }
    toast.success(`Checked in! Queue #${data.queueNumber}`);
    router.push(`/status/${data.queueNumber}`);
  }

  if (type === "appointment") {
    return (
      <form onSubmit={appointmentCheckin} className="space-y-4 max-w-md">
        <div>
          <Label>Appointment Reference Number</Label>
          <Input value={ref} onChange={(e) => setRef(e.target.value)} required placeholder="APPT..." />
        </div>
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? "Checking in..." : "Check In"}
        </Button>
      </form>
    );
  }

  return (
    <form onSubmit={walkInCheckin} className="space-y-4 max-w-md">
      {!patientId && (
        <p className="text-amber-600 text-sm">
          No patient selected.{" "}
          <a href="/patient-search" className="underline">
            Search patient
          </a>{" "}
          or{" "}
          <a href="/registration" className="underline">
            register
          </a>
          .
        </p>
      )}
      <div>
        <Label>Visit Type</Label>
        <Select value={apptType} onValueChange={(v) => setApptType(v ?? "")} required>
          <SelectTrigger>
            <SelectValue placeholder="Select visit type" />
          </SelectTrigger>
          <SelectContent>
            {types.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Reason for visit</Label>
        <Textarea name="reason" required placeholder="Brief description" />
      </div>
      <Button type="submit" disabled={loading || !patientId} className="w-full">
        {loading ? "Checking in..." : "Complete Check-In"}
      </Button>
    </form>
  );
}

"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Appointment = {
  checkin_id: number;
  reference_number: string;
  scheduled_time: string | null;
  appointment_date: string;
  status: string | null;
  appointment_types: { name: string } | null;
  staff: { first_name: string; last_name: string } | null;
};

export function MyAppointments() {
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(false);

  async function lookup() {
    setLoading(true);
    const res = await fetch(
      `/api/appointments?phone=${encodeURIComponent(phone)}&dob=${dob}`
    );
    const data = await res.json();
    setAppointments(data.appointments ?? []);
    setLoading(false);
  }

  async function cancel(ref: string) {
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "cancel", reference: ref, phone }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Cancel failed");
      return;
    }
    toast.success("Appointment cancelled");
    lookup();
  }

  return (
    <div className="space-y-6 max-w-xl">
      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <Label>Phone</Label>
          <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" />
        </div>
        <div>
          <Label>Date of Birth</Label>
          <Input value={dob} onChange={(e) => setDob(e.target.value)} type="date" />
        </div>
      </div>
      <Button onClick={lookup} disabled={loading}>
        Look Up Appointments
      </Button>
      <div className="space-y-3">
        {appointments.map((a) => (
          <Card key={a.checkin_id}>
            <CardContent className="py-4 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{a.reference_number}</p>
                  <p className="text-sm text-muted-foreground">
                    Dr. {a.staff?.first_name} {a.staff?.last_name} — {a.appointment_types?.name}
                  </p>
                  <p className="text-sm">
                    {new Date(a.appointment_date).toLocaleDateString()} at {a.scheduled_time}
                  </p>
                </div>
                <Badge variant="secondary">{a.status}</Badge>
              </div>
              {a.status === "pending" && (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => cancel(a.reference_number)}
                >
                  Cancel
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

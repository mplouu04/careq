"use client";

import { appointmentApi } from "@/lib/api/client";

import { useState } from "react";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import {
  CareqCard,
  CareqButton,
  CareqCardHeader,
  ConfirmDialog,
  EmptyState,
  FormLabel,
  FormInput,
  StatusBadge,
  type QueueStatusVariant,
} from "@/components/careq";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isValidRef } from "@/lib/utils";

type LookupMethod = "phone" | "reference";

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

const STATUS_VARIANT: Record<string, QueueStatusVariant> = {
  pending: "waiting",
  checked_in: "confirmed",
  cancelled: "cancelled",
  no_show: "no_show",
  in_progress: "called",
  completed: "completed",
};

const TERMINAL_STATUSES = ["cancelled", "completed", "no_show"];

export function MyAppointments() {
  const [lookupMethod, setLookupMethod] = useState<LookupMethod>("phone");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [reference, setReference] = useState("");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [patientName, setPatientName] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [cancelRef, setCancelRef] = useState<string | null>(null);

  function resetResults() {
    setSearched(false);
    setAppointments([]);
    setPatientName("");
  }

  function handleLookupMethodChange(method: string) {
    if (method !== "phone" && method !== "reference") return;
    setLookupMethod(method);
    resetResults();
  }

  async function lookupByPhone() {
    if (!phone || !dob) {
      toast.error("Please enter both phone number and date of birth.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/appointments?phone=${encodeURIComponent(phone)}&dob=${dob}`
      );
      const data = res.ok ? await res.json() : { appointments: [], patientName: "" };
      setAppointments(data.appointments ?? []);
      setPatientName(data.patientName ?? "");
    } catch {
      toast.error("Unable to load appointments. Please check your connection.");
      setAppointments([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  async function lookupByReference() {
    const ref = reference.trim();
    if (!ref) {
      toast.error("Please enter your reference number.");
      return;
    }
    if (!isValidRef(ref)) {
      toast.error("Invalid reference format.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments?reference=${encodeURIComponent(ref)}`);
      const data = res.ok ? await res.json() : { appointments: [], patientName: "" };
      setAppointments(data.appointments ?? []);
      setPatientName(data.patientName ?? "");
    } catch {
      toast.error("Unable to load appointments. Please check your connection.");
      setAppointments([]);
    } finally {
      setLoading(false);
      setSearched(true);
    }
  }

  async function lookup() {
    if (lookupMethod === "phone") {
      await lookupByPhone();
    } else {
      await lookupByReference();
    }
  }

  async function confirmCancel(ref: string) {
    setCancelRef(null);
    try {
      await appointmentApi.cancel(ref, phone);
      toast.success("Appointment cancelled.");
      await lookup();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    }
  }

  return (
    <div className="space-y-5 max-w-xl">
      <CareqCard className="overflow-hidden">
        <CareqCardHeader
          title="Look Up Appointments"
          description={
            lookupMethod === "phone"
              ? "Enter your phone and date of birth"
              : "Enter the reference code from your booking confirmation"
          }
        />
        <div className="px-6 py-5">
          <Tabs value={lookupMethod} onValueChange={handleLookupMethodChange}>
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="phone" className="flex-1">
                By Phone &amp; DOB
              </TabsTrigger>
              <TabsTrigger value="reference" className="flex-1">
                By Reference
              </TabsTrigger>
            </TabsList>

            <TabsContent value="phone">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <FormLabel>Phone Number</FormLabel>
                  <FormInput
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="09XXXXXXXXX"
                  />
                </div>
                <div>
                  <FormLabel>Date of Birth</FormLabel>
                  <FormInput type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="reference">
              <div className="mb-4">
                <FormLabel>Reference Number</FormLabel>
                <FormInput
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="APT..."
                  className="font-mono"
                  autoCapitalize="characters"
                />
              </div>
            </TabsContent>
          </Tabs>

          <CareqButton onClick={lookup} disabled={loading} className="w-full">
            <ClipboardList className="h-4 w-4" />
            {loading ? "Looking up..." : "Look Up Appointments"}
          </CareqButton>
        </div>
      </CareqCard>

      {searched && (
        <>
          {patientName && (
            <p className="text-headline-sm text-foreground">
              Hello, <strong>{patientName}</strong>!
            </p>
          )}
          {appointments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No upcoming appointments"
              description="We could not find any appointments for the details provided."
            />
          ) : (
            <div className="space-y-3">
              {appointments.map((a) => (
                <CareqCard key={a.checkinId} className="p-4 md:p-5 space-y-3 border-outline-variant">
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-headline-sm text-primary truncate">
                        {a.reference}
                      </p>
                      <p className="text-body-sm text-on-surface-variant">
                        {a.doctor} — {a.type}
                      </p>
                      <p className="text-body-sm text-foreground">
                        {a.date} at {a.time}
                      </p>
                      {a.reason && (
                        <p className="text-body-sm text-on-surface-variant">Reason: {a.reason}</p>
                      )}
                    </div>
                    <StatusBadge
                      status={STATUS_VARIANT[a.status] ?? "pending"}
                      label={STATUS_LABELS[a.status] ?? a.status}
                    />
                  </div>
                  {!TERMINAL_STATUSES.includes(a.status) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => setCancelRef(a.reference)}
                    >
                      Cancel Appointment
                    </Button>
                  )}
                </CareqCard>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!cancelRef}
        onOpenChange={(open) => !open && setCancelRef(null)}
        title="Cancel Appointment"
        description={
          cancelRef
            ? `Are you sure you want to cancel appointment ${cancelRef}? This cannot be undone.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setCancelRef(null)}>
              Go Back
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelRef && confirmCancel(cancelRef)}
            >
              Yes, Cancel
            </Button>
          </>
        }
      />
    </div>
  );
}

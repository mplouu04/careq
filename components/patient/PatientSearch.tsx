"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, UserPlus } from "lucide-react";
import {
  CareqCard,
  CareqButton,
  CareqCardHeader,
  ConfirmDialog,
  EmptyState,
  FormLabel,
  FormInput,
  FormInfo,
} from "@/components/careq";
import { Button } from "@/components/ui/button";

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
    const { patient, destination } = verifyModal;
    setVerifyModal(null);
    goTo(patient, destination);
  }

  return (
    <>
      <CareqCard className="overflow-hidden max-w-2xl">
        <CareqCardHeader
          title="Find Patient"
          description="Search by name or phone number"
        />

        <div className="px-6 py-5">
          <form onSubmit={search} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormLabel>Search Term</FormLabel>
                <FormInput
                  type="text"
                  placeholder="Name or phone number"
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  required
                  minLength={2}
                />
              </div>
              <div>
                <FormLabel>Date of Birth</FormLabel>
                <FormInput
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                />
              </div>
            </div>
            <CareqButton
              type="submit"
              disabled={loading || term.trim().length < 2}
              className="w-full"
            >
              <Search className="h-4 w-4" />
              {loading ? "Searching..." : "Search Patient"}
            </CareqButton>
          </form>

          {searched && (
            <div className="mt-6">
              <h4 className="text-headline-sm text-foreground mb-4">Search Results</h4>

              {patients.length > 1 && (
                <FormInfo>
                  Multiple records matched. Booking or check-in will ask for the{" "}
                  <strong>last 4 digits</strong> of the selected patient&apos;s phone number.
                </FormInfo>
              )}

              {patients.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No patients found"
                  description="Try a different name or phone number, or register as a new patient."
                  action={
                    <CareqButton asChild>
                      <Link href="/registration">
                        <UserPlus className="h-4 w-4" />
                        Register new patient
                      </Link>
                    </CareqButton>
                  }
                />
              ) : (
                <div className="space-y-3">
                  {patients.map((p) => (
                    <CareqCard
                      key={p.id}
                      className="p-4 flex flex-wrap items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-foreground">
                          {p.first_name} {p.last_name}
                        </p>
                        <p className="text-body-sm text-muted-foreground">
                          DOB: {p.dob} · {p.gender}
                        </p>
                        <p className="text-body-sm text-muted-foreground">
                          {p.phone} · {p.address}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
                        <Button
                          type="button"
                          variant="outline"
                          className="flex-1 sm:flex-none border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                          onClick={() => navigate(p, "appointments")}
                        >
                          Book Appointment
                        </Button>
                        <CareqButton
                          type="button"
                          className="flex-1 sm:flex-none"
                          onClick={() => navigate(p, "checkin")}
                        >
                          Check In
                        </CareqButton>
                      </div>
                    </CareqCard>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </CareqCard>

      <p className="mt-4 text-body-sm text-muted-foreground">
        New patient?{" "}
        <Link href="/registration" className="text-primary hover:underline font-medium">
          Register here
        </Link>
      </p>

      <ConfirmDialog
        open={!!verifyModal}
        onOpenChange={(open) => !open && setVerifyModal(null)}
        title="Verify Identity"
        description={
          verifyModal
            ? `Multiple matches found. Enter the last 4 digits of ${verifyModal.patient.first_name} ${verifyModal.patient.last_name}'s phone number to confirm.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setVerifyModal(null)}>
              Cancel
            </Button>
            <CareqButton
              onClick={handleVerify}
              disabled={verifyInput.length !== 4}
            >
              Confirm
            </CareqButton>
          </>
        }
      >
        <FormInput
          type="text"
          placeholder="Last 4 digits"
          maxLength={4}
          value={verifyInput}
          inputMode="numeric"
          onChange={(e) => {
            setVerifyInput(e.target.value.replace(/\D/g, ""));
            setVerifyError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          className="text-center text-lg tracking-widest"
        />
        {verifyError && (
          <p className="text-destructive text-body-sm mt-2">{verifyError}</p>
        )}
      </ConfirmDialog>
    </>
  );
}

"use client";

import { useState, useEffect, useCallback, useId, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, UserPlus, Calendar, LogIn } from "lucide-react";
import { minSearchLength } from "@/lib/patient-search";
import {
  CareqCard,
  CareqButton,
  ConfirmDialog,
  EmptyState,
  FormLabel,
  FormInput,
  FormHelperText,
  FormError,
} from "@/components/careq";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "••••";
  return `•••• ${digits.slice(-4)}`;
}

export function PatientSearch() {
  const router = useRouter();
  const formId = useId();
  const termHintId = `${formId}-term-hint`;
  const resultsLiveId = `${formId}-results-live`;

  const [term, setTerm] = useState("");
  const [dob, setDob] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [verifyModal, setVerifyModal] = useState<{
    patient: Patient;
    destination: "appointments" | "checkin";
  } | null>(null);
  const [verifyInput, setVerifyInput] = useState("");
  const [verifyError, setVerifyError] = useState("");

  const trimmedTerm = term.trim();
  const canSearch = minSearchLength(trimmedTerm);

  const validationMessage = useMemo(() => {
    if (!trimmedTerm || canSearch) return null;
    if (/^\d+$/.test(trimmedTerm)) return "Enter at least one digit.";
    return "Enter at least 2 characters.";
  }, [trimmedTerm, canSearch]);

  const runSearch = useCallback(async () => {
    if (!minSearchLength(trimmedTerm)) {
      setPatients([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ term: trimmedTerm });
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
  }, [trimmedTerm, dob]);

  useEffect(() => {
    if (!canSearch) {
      setPatients([]);
      if (!trimmedTerm) setSearched(false);
      return;
    }
    const timer = setTimeout(() => runSearch(), 350);
    return () => clearTimeout(timer);
  }, [trimmedTerm, dob, canSearch, runSearch]);

  function handleSearch() {
    setSubmitAttempted(true);
    if (!canSearch) return;
    runSearch();
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
      setVerifyError("Last 4 digits do not match.");
      return;
    }
    const { patient, destination } = verifyModal;
    setVerifyModal(null);
    goTo(patient, destination);
  }

  const showValidation = submitAttempted && validationMessage;

  return (
    <>
      <CareqCard className="overflow-hidden w-full">
        <div className="px-5 sm:px-6 py-5 space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormLabel htmlFor={`${formId}-term`} required>
                  Search term
                </FormLabel>
                <FormInput
                  id={`${formId}-term`}
                  type="search"
                  placeholder="Name, phone, or patient #"
                  value={term}
                  onChange={(e) => {
                    setTerm(e.target.value);
                    setSubmitAttempted(false);
                  }}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  autoComplete="off"
                  inputMode="search"
                  aria-required="true"
                  aria-invalid={showValidation ? true : undefined}
                  aria-describedby={termHintId}
                />
                <FormHelperText id={termHintId}>
                  2+ letters or phone digits.
                </FormHelperText>
              </div>
              <div>
                <FormLabel htmlFor={`${formId}-dob`}>
                  Date of birth{" "}
                  <span className="text-on-surface-variant font-normal">(optional)</span>
                </FormLabel>
                <FormInput
                  id={`${formId}-dob`}
                  type="date"
                  value={dob}
                  onChange={(e) => setDob(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  min="1900-01-01"
                />
              </div>
            </div>

            {showValidation && validationMessage && <FormError message={validationMessage} />}

            <CareqButton
              type="button"
              className="w-full min-h-[44px] cursor-pointer"
              disabled={loading}
              onClick={handleSearch}
              aria-describedby={termHintId}
            >
              <Search className="h-4 w-4" aria-hidden />
              {loading ? "Searching…" : "Search patient"}
            </CareqButton>

            <p
              className="text-body-sm text-on-surface-variant text-center"
              title="We mask phone numbers and verify identity when multiple patients match."
            >
              <span className="text-primary underline decoration-dotted underline-offset-2 cursor-help">
                How we protect your data
              </span>
            </p>
          </div>

          {loading && (
            <div className="space-y-2" aria-busy="true" aria-label="Loading results">
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          )}

          {searched && !loading && (
            <section aria-labelledby={`${formId}-results-heading`}>
              <div className="flex items-baseline justify-between gap-2 mb-3">
                <h2 id={`${formId}-results-heading`} className="text-headline-sm text-on-surface">
                  Results
                </h2>
                <p
                  id={resultsLiveId}
                  className="text-body-sm text-on-surface-variant"
                  aria-live="polite"
                >
                  {patients.length === 0
                    ? "No matches"
                    : `${patients.length} found`}
                </p>
              </div>

              {patients.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No patients found"
                  description="Try different spelling or add date of birth."
                  className="py-6"
                  action={
                    <CareqButton asChild>
                      <Link href="/registration">
                        <UserPlus className="h-4 w-4" />
                        Register
                      </Link>
                    </CareqButton>
                  }
                />
              ) : (
                <ul className="space-y-2" role="list">
                  {patients.map((p) => (
                    <li key={p.id}>
                      <CareqCard className="p-3 sm:p-4 border-outline-variant">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-body-md text-on-surface">
                              {p.first_name} {p.last_name}
                            </p>
                            <p className="text-body-sm text-on-surface-variant">
                              {maskPhone(p.phone)} · #{p.id}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <CareqButton
                              type="button"
                              size="sm"
                              className="min-h-[44px] flex-1 sm:flex-none cursor-pointer"
                              onClick={() => navigate(p, "checkin")}
                            >
                              <LogIn className="h-4 w-4" />
                              Check in today
                            </CareqButton>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="min-h-[44px] flex-1 sm:flex-none rounded-xl border-primary text-primary cursor-pointer"
                              onClick={() => navigate(p, "appointments")}
                            >
                              <Calendar className="h-4 w-4" />
                              Book
                            </Button>
                          </div>
                        </div>
                      </CareqCard>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          <p className="text-body-sm text-on-surface-variant text-center pt-2 border-t border-outline-variant">
            New patient?{" "}
            <Link href="/registration" className="text-primary font-medium hover:underline">
              Register
            </Link>
          </p>
        </div>
      </CareqCard>

      <ConfirmDialog
        open={!!verifyModal}
        onOpenChange={(open) => !open && setVerifyModal(null)}
        title="Verify identity"
        description={
          verifyModal
            ? `Enter last 4 digits of ${verifyModal.patient.first_name}'s phone.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setVerifyModal(null)}>
              Cancel
            </Button>
            <CareqButton onClick={handleVerify} disabled={verifyInput.length !== 4}>
              Confirm
            </CareqButton>
          </>
        }
      >
        <FormLabel htmlFor={`${formId}-verify`}>Last 4 digits</FormLabel>
        <FormInput
          id={`${formId}-verify`}
          type="text"
          maxLength={4}
          value={verifyInput}
          inputMode="numeric"
          onChange={(e) => {
            setVerifyInput(e.target.value.replace(/\D/g, ""));
            setVerifyError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          className="text-center text-lg tracking-widest font-mono-careq"
        />
        {verifyError && (
          <p className="text-destructive text-body-sm mt-2" role="alert">
            {verifyError}
          </p>
        )}
      </ConfirmDialog>
    </>
  );
}

"use client";

import { useState, useEffect, useCallback, useId, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search,
  UserPlus,
  Shield,
  Calendar,
  LogIn,
  Lightbulb,
} from "lucide-react";
import { minSearchLength } from "@/lib/patient-search";
import {
  CareqCard,
  CareqButton,
  CareqCardHeader,
  ConfirmDialog,
  EmptyState,
  FormLabel,
  FormInput,
  FormInfo,
  FormHelperText,
  FormError,
} from "@/components/careq";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

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
  const dobHintId = `${formId}-dob-hint`;
  const submitHintId = `${formId}-submit-hint`;
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
    if (!trimmedTerm) return null;
    if (canSearch) return null;
    if (/^\d+$/.test(trimmedTerm)) {
      return "Enter at least one digit for phone or patient ID.";
    }
    return "Enter at least 2 characters of a name.";
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
    const timer = setTimeout(() => {
      runSearch();
    }, 350);
    return () => clearTimeout(timer);
  }, [trimmedTerm, dob, canSearch, runSearch]);

  async function search(e?: React.FormEvent) {
    if (e) e.preventDefault();
    setSubmitAttempted(true);
    if (!canSearch) return;
    await runSearch();
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

  const showValidation = submitAttempted && validationMessage;
  const submitBlockedReason = !canSearch
    ? trimmedTerm
      ? validationMessage
      : "Enter a name, phone number, or patient ID to search."
    : null;

  return (
    <>
      <CareqCard className="overflow-hidden w-full shadow-sm border-outline-variant">
        <CareqCardHeader
          title="Find your profile"
          description="Search our records to check in for today's visit or book an appointment."
        />

        <div className="px-5 sm:px-6 py-5 space-y-5">
          <FormInfo>
            <strong className="text-on-surface">How this works:</strong> Search first, then
            choose <strong>Check in</strong> if you are at the clinic today, or{" "}
            <strong>Book appointment</strong> for a future visit. Date of birth is optional
            but helps narrow matches.
          </FormInfo>

          <form onSubmit={search} className="space-y-4" noValidate>
            <fieldset className="space-y-4">
              <legend className="sr-only">Patient search criteria</legend>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <FormLabel htmlFor={`${formId}-term`} required>
                    Search term
                  </FormLabel>
                  <FormInput
                    id={`${formId}-term`}
                    type="search"
                    placeholder="e.g. Maria, 09171234567, or 42"
                    value={term}
                    onChange={(e) => {
                      setTerm(e.target.value);
                      setSubmitAttempted(false);
                    }}
                    autoComplete="off"
                    inputMode="search"
                    aria-required="true"
                    aria-invalid={showValidation ? true : undefined}
                    aria-describedby={termHintId}
                  />
                  <FormHelperText id={termHintId}>
                    Required · At least 2 letters of a name, or digits from phone / patient ID.
                    Partial matches are OK.
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
                    aria-describedby={dobHintId}
                  />
                  <FormHelperText id={dobHintId}>
                    Uses the clinic calendar picker — no manual typing. Narrows results when
                    several patients share a name.
                  </FormHelperText>
                </div>
              </div>

              {showValidation && validationMessage && (
                <FormError message={validationMessage} />
              )}

              <div className="rounded-lg border border-outline-variant bg-surface-container-low px-4 py-3 flex gap-3">
                <Lightbulb
                  className="h-5 w-5 text-primary shrink-0 mt-0.5"
                  aria-hidden
                />
                <div className="text-body-sm text-on-surface-variant space-y-1">
                  <p className="font-medium text-on-surface">Search examples</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Full or partial name: <span className="text-on-surface">Santos</span> or <span className="text-on-surface">Maria Sa</span></li>
                    <li>Phone digits: <span className="text-on-surface font-mono-careq">0917</span> or full <span className="text-on-surface font-mono-careq">09XXXXXXXXX</span></li>
                    <li>Patient ID number if you have it</li>
                  </ul>
                </div>
              </div>
            </fieldset>

            <div className="space-y-2">
              <CareqButton
                type="submit"
                disabled={loading}
                aria-disabled={!canSearch && !loading ? true : undefined}
                aria-describedby={submitHintId}
                className={cn(
                  "w-full min-h-[48px]",
                  !canSearch && !loading && "opacity-100"
                )}
              >
                <Search className="h-4 w-4" aria-hidden />
                {loading ? "Searching…" : "Search patient"}
              </CareqButton>
              <p
                id={submitHintId}
                className={cn(
                  "text-body-sm text-center",
                  submitBlockedReason
                    ? "text-on-surface"
                    : canSearch
                      ? "text-on-surface-variant"
                      : "text-on-surface-variant"
                )}
                role="status"
              >
                {loading
                  ? "Looking for matching profiles…"
                  : submitBlockedReason ??
                    (canSearch
                      ? "Results update automatically as you type."
                      : "Enter a search term above to continue.")}
              </p>
            </div>
          </form>

          <div
            className="flex gap-2 items-start rounded-lg border border-outline-variant/80 bg-surface-container-lowest px-4 py-3"
            role="note"
          >
            <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" aria-hidden />
            <p className="text-body-sm text-on-surface-variant">
              <span className="font-medium text-on-surface">Privacy:</span> Only staff and
              verified patients can access full records. Multiple matches require phone
              verification. We never show complete phone numbers in search results.
            </p>
          </div>

          {loading && (
            <div
              className="space-y-2 pt-2"
              aria-busy="true"
              aria-label="Loading search results"
            >
              <Skeleton className="h-14 w-full rounded-lg" />
              <Skeleton className="h-14 w-full rounded-lg" />
            </div>
          )}

          {!loading && !searched && !trimmedTerm && (
            <EmptyState
              icon={Search}
              title="Ready when you are"
              description="Enter a name, phone digits, or patient ID above. We'll show matching profiles here."
              className="border border-dashed border-outline-variant bg-surface-container-low/50 py-8"
            />
          )}

          {searched && !loading && (
            <section aria-labelledby={`${formId}-results-heading`}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-4">
                <h2
                  id={`${formId}-results-heading`}
                  className="text-headline-sm text-on-surface"
                >
                  Search results
                </h2>
                <p
                  id={resultsLiveId}
                  className="text-body-sm text-on-surface-variant"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {patients.length === 0
                    ? "No matches found"
                    : `${patients.length} match${patients.length === 1 ? "" : "es"} found`}
                </p>
              </div>

              {patients.length > 1 && (
                <FormInfo>
                  Multiple profiles matched. You will be asked for the{" "}
                  <strong>last 4 digits</strong> of the selected patient&apos;s phone before
                  continuing.
                </FormInfo>
              )}

              {patients.length === 0 ? (
                <EmptyState
                  icon={Search}
                  title="No patients found"
                  description="Try a different spelling, more phone digits, or add date of birth. If you have never visited us, register as a new patient."
                  className="py-8"
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
                <ul className="space-y-3" role="list">
                  {patients.map((p) => (
                    <li key={p.id}>
                      <CareqCard className="p-4 sm:p-5 border-outline-variant">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-on-surface text-body-md">
                              {p.first_name} {p.last_name}
                            </p>
                            <p className="text-body-sm text-on-surface-variant mt-0.5">
                              DOB: {p.dob} · {p.gender}
                            </p>
                            <p className="text-body-sm text-on-surface-variant">
                              Phone: {maskPhone(p.phone)} · {p.address}
                            </p>
                            <p className="text-label-sm text-on-surface-variant mt-1 font-mono-careq">
                              Patient #{p.id}
                            </p>
                          </div>
                          <div className="flex flex-col gap-2 w-full sm:w-auto sm:min-w-[160px]">
                            <CareqButton
                              type="button"
                              className="w-full min-h-[44px]"
                              onClick={() => navigate(p, "checkin")}
                            >
                              <LogIn className="h-4 w-4" />
                              Check in today
                            </CareqButton>
                            <Button
                              type="button"
                              variant="outline"
                              className="w-full min-h-[44px] rounded-xl border-primary text-primary hover:bg-primary hover:text-primary-foreground"
                              onClick={() => navigate(p, "appointments")}
                            >
                              <Calendar className="h-4 w-4" />
                              Book appointment
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

          <div className="border-t border-outline-variant pt-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl bg-primary/5 border border-primary/20 px-4 py-4">
              <div>
                <p className="text-body-md font-semibold text-on-surface">
                  First time at this clinic?
                </p>
                <p className="text-body-sm text-on-surface-variant mt-0.5">
                  Create a profile once, then search and check in faster next time.
                </p>
              </div>
              <CareqButton asChild variant="outline" className="shrink-0 min-h-[44px] border-primary">
                <Link href="/registration">
                  <UserPlus className="h-4 w-4" />
                  Register new patient
                </Link>
              </CareqButton>
            </div>
          </div>
        </div>
      </CareqCard>

      <ConfirmDialog
        open={!!verifyModal}
        onOpenChange={(open) => !open && setVerifyModal(null)}
        title="Verify identity"
        description={
          verifyModal
            ? `For your privacy, confirm ${verifyModal.patient.first_name} ${verifyModal.patient.last_name} by entering the last 4 digits of their phone number on file.`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setVerifyModal(null)}>
              Cancel
            </Button>
            <CareqButton onClick={handleVerify} disabled={verifyInput.length !== 4}>
              Confirm and continue
            </CareqButton>
          </>
        }
      >
        <FormLabel htmlFor={`${formId}-verify`}>Last 4 digits of phone</FormLabel>
        <FormInput
          id={`${formId}-verify`}
          type="text"
          placeholder="••••"
          maxLength={4}
          value={verifyInput}
          inputMode="numeric"
          autoComplete="off"
          onChange={(e) => {
            setVerifyInput(e.target.value.replace(/\D/g, ""));
            setVerifyError("");
          }}
          onKeyDown={(e) => e.key === "Enter" && handleVerify()}
          className="text-center text-lg tracking-widest font-mono-careq"
          aria-invalid={verifyError ? true : undefined}
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

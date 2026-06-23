"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { UserPlus, LogIn, User, ArrowLeft } from "lucide-react";
import {
  CareqCard,
  CareqButton,
  ConfirmDialog,
  FormLabel,
  FormInput,
  FormHelperText,
  FormError,
} from "@/components/careq";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type VerifyMatch = {
  firstName: string;
  verifyToken: string;
};

const NO_MATCH_MESSAGE =
  "We could not find a record matching those details. Please check your information or register as a new patient.";

const API_ERROR_MESSAGE =
  "Something went wrong. Please try again.";

export function PatientSearch() {
  const router = useRouter();
  const formId = useId();
  const dobHintId = `${formId}-dob-hint`;
  const phoneHintId = `${formId}-phone-hint`;

  const [dob, setDob] = useState("");
  const [phoneLast7, setPhoneLast7] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [match, setMatch] = useState<VerifyMatch | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  const [apiError, setApiError] = useState(false);

  const phoneDigits = phoneLast7.replace(/\D/g, "");
  const dobValid = /^\d{4}-\d{2}-\d{2}$/.test(dob);
  const phoneValid = /^\d{7}$/.test(phoneDigits);
  const canSubmit = dobValid && phoneValid;

  const validationMessage = (() => {
    if (!submitAttempted) return null;
    if (!dob) return "Enter your date of birth.";
    if (!dobValid) return "Enter a valid date of birth.";
    if (!phoneDigits) return "Enter the last 7 digits of your phone number.";
    if (!phoneValid) return "Phone last 7 digits must be exactly 7 digits.";
    return null;
  })();

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setNoMatch(false);
    setApiError(false);
    if (!canSubmit) return;

    setLoading(true);
    try {
      const res = await fetch("/api/patient-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob, phoneLast7: phoneDigits }),
      });
      if (!res.ok) {
        setMatch(null);
        setApiError(true);
        return;
      }

      const data = await res.json();

      if (data.matched && data.firstName && data.verifyToken) {
        setMatch({ firstName: data.firstName, verifyToken: data.verifyToken });
        return;
      }

      setMatch(null);
      setNoMatch(true);
    } catch {
      setMatch(null);
      setApiError(true);
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setMatch(null);
    setNoMatch(false);
    setApiError(false);
    setSubmitAttempted(false);
    setDob("");
    setPhoneLast7("");
  }

  function confirmIdentity() {
    if (!match) return;
    router.push(`/checkin?verifyToken=${encodeURIComponent(match.verifyToken)}`);
  }

  if (match) {
    return (
      <>
        <CareqCard className="overflow-hidden w-full">
          <div className="px-5 sm:px-6 py-8 text-center space-y-6">
            <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-7 w-7 text-primary" aria-hidden />
            </div>
            <div className="space-y-2">
              <h2 className="text-headline-sm text-on-surface">
                Welcome, {match.firstName}
              </h2>
              <p className="text-body-md text-on-surface-variant">Is this you?</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <CareqButton
                type="button"
                className="min-h-11 cursor-pointer"
                onClick={confirmIdentity}
              >
                <LogIn className="h-4 w-4" />
                Yes, continue to check-in
              </CareqButton>
              <Button
                type="button"
                variant="outline"
                className="min-h-11 rounded-xl cursor-pointer"
                onClick={resetForm}
              >
                <ArrowLeft className="h-4 w-4" />
                No, try again
              </Button>
            </div>
          </div>
        </CareqCard>

        <ConfirmDialog
          open={privacyOpen}
          onOpenChange={setPrivacyOpen}
          title="Your privacy"
          description="We verify your identity with your date of birth and phone number. Only your first name is shown before check-in."
          footer={
            <CareqButton type="button" onClick={() => setPrivacyOpen(false)}>
              Got it
            </CareqButton>
          }
        />
      </>
    );
  }

  return (
    <>
      <CareqCard className="overflow-hidden w-full">
        <form onSubmit={handleVerify} className="px-5 sm:px-6 py-5 space-y-4">
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormLabel htmlFor={`${formId}-dob`} required>
                  Date of birth
                </FormLabel>
                <FormInput
                  id={`${formId}-dob`}
                  type="date"
                  value={dob}
                  onChange={(e) => {
                    setDob(e.target.value);
                    setSubmitAttempted(false);
                    setNoMatch(false);
                    setApiError(false);
                  }}
                  max={new Date().toISOString().slice(0, 10)}
                  min="1900-01-01"
                  required
                  aria-required="true"
                  aria-describedby={dobHintId}
                />
              </div>
              <div>
                <FormLabel htmlFor={`${formId}-phone`} required>
                  Last 7 digits of phone
                </FormLabel>
                <FormInput
                  id={`${formId}-phone`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={7}
                  placeholder="1234567"
                  value={phoneLast7}
                  onChange={(e) => {
                    setPhoneLast7(e.target.value.replace(/\D/g, "").slice(0, 7));
                    setSubmitAttempted(false);
                    setNoMatch(false);
                    setApiError(false);
                  }}
                  required
                  aria-required="true"
                  aria-describedby={phoneHintId}
                  className="font-mono-careq tracking-widest"
                />
              </div>
            </div>

            <FormHelperText id={dobHintId}>
              Use the date of birth on your patient record.
            </FormHelperText>
            <FormHelperText id={phoneHintId}>
              Enter the last 7 digits of the phone number we have on file.
            </FormHelperText>

            {validationMessage && <FormError message={validationMessage} />}
            {apiError && <FormError message={API_ERROR_MESSAGE} />}
            {noMatch && <FormError message={NO_MATCH_MESSAGE} />}

            <CareqButton
              type="submit"
              className={cn("w-full sm:w-auto min-h-11 cursor-pointer")}
              disabled={loading}
            >
              {loading ? "Verifying…" : "Continue"}
            </CareqButton>

            <p className="text-body-sm text-on-surface-variant text-center">
              <button
                type="button"
                onClick={() => setPrivacyOpen(true)}
                className="text-primary underline decoration-dotted underline-offset-2 cursor-pointer hover:decoration-solid transition-colors"
              >
                How we protect your data
              </button>
            </p>
          </div>

          <p className="text-body-sm text-on-surface-variant text-center pt-2 border-t border-outline-variant">
            New patient?{" "}
            <Link
              href="/registration"
              className="inline-flex items-center gap-1 text-primary font-medium hover:underline cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              Register
            </Link>
          </p>
        </form>
      </CareqCard>

      <ConfirmDialog
        open={privacyOpen}
        onOpenChange={setPrivacyOpen}
        title="Your privacy"
        description="We verify your identity with your date of birth and phone number. Only your first name is shown before check-in. We never display a list of patient records."
        footer={
          <CareqButton type="button" onClick={() => setPrivacyOpen(false)}>
            Got it
          </CareqButton>
        }
      />
    </>
  );
}

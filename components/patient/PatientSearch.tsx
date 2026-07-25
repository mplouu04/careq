"use client";

import { useState, useId } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  UserPlus,
  LogIn,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  CareqCard,
  CareqButton,
  ConfirmDialog,
  FormFieldGroup,
  FormLabel,
  FormInput,
  FormHelperText,
  FormError,
} from "@/components/careq";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import { storeVerifyToken } from "@/lib/verify-session";

type VerifyMatch = {
  firstName: string;
  verifyToken: string;
};

const NO_MATCH_MESSAGE =
  "We could not find a record matching those details. Please check your information or register as a new patient.";

export function PatientSearch() {
  const router = useRouter();
  const formId = useId();
  const dobHintId = `${formId}-dob-hint`;
  const phoneHintId = `${formId}-phone-hint`;
  const errorId = `${formId}-error`;

  const [dob, setDob] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [match, setMatch] = useState<VerifyMatch | null>(null);
  const [noMatch, setNoMatch] = useState(false);
  const [apiError, setApiError] = useState(false);
  const [apiErrorMessage, setApiErrorMessage] = useState("");

  const phoneDigits = phoneInput.replace(/\D/g, "");
  const dobValid = /^\d{4}-\d{2}-\d{2}$/.test(dob);
  const phoneValid = phoneDigits.length >= 7;
  const canSubmit = dobValid && phoneValid;

  const validationMessage = (() => {
    if (!submitAttempted) return null;
    if (!dob) return "Enter your date of birth.";
    if (!dobValid) return "Enter a valid date of birth.";
    if (!phoneDigits) return "Enter your phone number.";
    if (!phoneValid) return "Phone number must have at least 7 digits.";
    return null;
  })();

  const dobInvalid = submitAttempted && (!dob || !dobValid);
  const phoneInvalid = submitAttempted && (!phoneDigits || !phoneValid);

  function setApiErrorWith(message: string) {
    setApiError(true);
    setApiErrorMessage(message);
  }

  function clearFeedback() {
    setSubmitAttempted(false);
    setNoMatch(false);
    setApiError(false);
    setApiErrorMessage("");
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setSubmitAttempted(true);
    setNoMatch(false);
    setApiError(false);
    setApiErrorMessage("");
    if (!canSubmit) return;

    setLoading(true);
    try {
      const res = await fetch("/api/patient-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dob, phoneLast7: phoneDigits }),
      });

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After") ?? 0);
        const minutes = Math.ceil(retryAfter / 60);
        setMatch(null);
        setApiErrorWith(
          minutes > 0
            ? `Too many attempts. Please wait ${minutes} minute${minutes !== 1 ? "s" : ""} before trying again.`
            : "Too many attempts. Please try again later."
        );
        return;
      }

      if (res.status === 400) {
        const body = await res.json().catch(() => ({}));
        setMatch(null);
        setApiErrorWith(
          (body as { error?: string }).error ?? "Invalid input. Please check your details."
        );
        return;
      }

      if (!res.ok) {
        setMatch(null);
        setApiErrorWith("Something went wrong. Please try again.");
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
      setApiErrorWith("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setMatch(null);
    setNoMatch(false);
    setApiError(false);
    setApiErrorMessage("");
    setSubmitAttempted(false);
    setDob("");
    setPhoneInput("");
  }

  function confirmIdentity() {
    if (!match) return;
    storeVerifyToken(match.verifyToken);
    router.push("/checkin?tab=walk-in");
  }

  if (match) {
    return (
      <>
        <CareqCard className="overflow-hidden w-full">
          <div className="bg-primary/5 px-6 py-4 border-b border-outline-variant" />
          <div className="px-6 py-8 text-center space-y-6">
            <div className="mx-auto w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="h-7 w-7 text-green-600" aria-hidden />
            </div>
            <div className="space-y-2">
              <h2 className="text-headline-md text-on-surface">
                Welcome, {match.firstName}
              </h2>
              <p className="text-body-md text-on-surface-variant">Is this you?</p>
            </div>
            <div className="flex flex-col gap-3">
              <CareqButton
                type="button"
                className="w-full h-12 min-h-12 cursor-pointer"
                onClick={confirmIdentity}
              >
                <LogIn className="h-4 w-4" />
                Yes, continue to check-in
              </CareqButton>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 min-h-12 rounded-xl cursor-pointer"
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
        <div className="px-6 pt-6 pb-4 border-b border-outline-variant text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
            <ShieldCheck className="h-6 w-6 text-primary" aria-hidden />
          </div>
          <div className="space-y-1">
            <h2 className="text-headline-sm text-on-surface">Verify your identity</h2>
            <p className="text-body-sm text-on-surface-variant">
              Enter your date of birth and phone number to continue.
            </p>
          </div>
        </div>

        <form onSubmit={handleVerify} className="px-6 py-6 space-y-4" noValidate>
          <FormFieldGroup>
            <FormLabel htmlFor={`${formId}-dob`} required>
              Date of birth
            </FormLabel>
            <FormInput
              id={`${formId}-dob`}
              type="date"
              value={dob}
              onChange={(e) => {
                setDob(e.target.value);
                clearFeedback();
              }}
              max={new Date().toLocaleDateString("en-CA")}
              min="1900-01-01"
              required
              aria-required="true"
              aria-invalid={dobInvalid || undefined}
              aria-describedby={cn(dobHintId, validationMessage || apiError || noMatch ? errorId : undefined)}
            />
            <FormHelperText id={dobHintId}>
              Use the date of birth on your patient record.
            </FormHelperText>
          </FormFieldGroup>

          <FormFieldGroup>
            <FormLabel htmlFor={`${formId}-phone`} required>
              Phone number
            </FormLabel>
            <FormInput
              id={`${formId}-phone`}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              maxLength={15}
              placeholder="09XX XXX XXXX"
              value={phoneInput}
              onChange={(e) => {
                setPhoneInput(e.target.value.replace(/\D/g, ""));
                clearFeedback();
              }}
              required
              aria-required="true"
              aria-invalid={phoneInvalid || undefined}
              aria-describedby={cn(phoneHintId, validationMessage || apiError || noMatch ? errorId : undefined)}
              className="font-mono-careq tracking-widest"
            />
            <FormHelperText id={phoneHintId}>
              Enter your full mobile number or just the last 7 digits.
            </FormHelperText>
          </FormFieldGroup>

          {validationMessage && (
            <div id={errorId}>
              <FormError message={validationMessage} />
            </div>
          )}
          {apiError && (
            <div id={errorId}>
              <FormError message={apiErrorMessage} />
            </div>
          )}
          {noMatch && (
            <Alert variant="destructive" className="mb-0" id={errorId}>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {NO_MATCH_MESSAGE}{" "}
                <Link
                  href="/registration"
                  className="inline-flex items-center gap-1 font-medium underline underline-offset-2 hover:opacity-90"
                >
                  <UserPlus className="h-3.5 w-3.5" aria-hidden />
                  Register
                </Link>
              </AlertDescription>
            </Alert>
          )}

          <div className="pt-2 space-y-4">
            <CareqButton
              type="submit"
              className="w-full h-12 min-h-12 cursor-pointer"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Verifying…
                </>
              ) : (
                "Continue"
              )}
            </CareqButton>

            <p className="text-body-sm text-on-surface-variant text-center">
              <button
                type="button"
                onClick={() => setPrivacyOpen(true)}
                className="inline-flex items-center gap-1.5 text-primary underline decoration-dotted underline-offset-2 cursor-pointer hover:decoration-solid transition-colors"
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden />
                How we protect your data
              </button>
            </p>
          </div>

          <p className="text-body-sm text-on-surface-variant text-center pt-4 border-t border-outline-variant">
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

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, Calendar, LogIn } from "lucide-react";
import {
  CareqCard,
  CareqButton,
  ConfirmDialog,
  CareqCardHeader,
  FormLabel,
  FormInput,
  FormSelect,
  FormError,
  StepIndicator,
  SuccessCard,
} from "@/components/careq";
import { Button } from "@/components/ui/button";
import { storeVerifyToken } from "@/lib/verify-session";

type RegStep = "personal" | "contact" | "consent";

export function RegistrationForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<RegStep>("personal");
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [consent, setConsent] = useState(false);
  const [matchedModal, setMatchedModal] = useState<{
    publicId: string;
    verifyToken?: string;
    matchedBy: string;
    message: string;
  } | null>(null);
  const [successPublicId, setSuccessPublicId] = useState<string | null>(null);
  const [successVerifyToken, setSuccessVerifyToken] = useState<string | null>(null);

  function navigateAfterRegister(publicId: string, token?: string) {
    if (redirectTo) {
      router.push(`${redirectTo}?publicId=${publicId}`);
    } else if (token) {
      storeVerifyToken(token);
      router.push("/checkin?tab=walk-in");
    } else {
      router.push("/patient-search");
    }
  }

  function validatePersonal(): boolean {
    if (!firstName.trim() || !lastName.trim() || !dob || !gender) {
      setError("Please complete all personal details.");
      return false;
    }
    const dobYear = parseInt(dob.slice(0, 4), 10);
    const currentYear = new Date().getFullYear();
    if (isNaN(dobYear) || dobYear < 1900 || dobYear > currentYear) {
      setError(`Date of birth must be between 1900 and ${currentYear}.`);
      return false;
    }
    setError(null);
    return true;
  }

  function validateContact(): boolean {
    const phoneDigits = phone.replace(/\D/g, "");
    if (phoneDigits.length !== 11) {
      setError("Phone number must be exactly 11 digits (e.g. 09XXXXXXXXX).");
      return false;
    }
    if (!address.trim()) {
      setError("Area is required.");
      return false;
    }
    setError(null);
    return true;
  }

  function goNext() {
    if (step === "personal" && validatePersonal()) setStep("contact");
    else if (step === "contact" && validateContact()) setStep("consent");
  }

  function goBack() {
    setError(null);
    if (step === "contact") setStep("personal");
    else if (step === "consent") setStep("contact");
    else router.push("/visit");
  }

  async function submitRegistration() {
    if (!consent) {
      setError("You must consent to continue.");
      return;
    }
    if (!validatePersonal() || !validateContact()) return;

    setLoading(true);
    setError(null);
    const phoneDigits = phone.replace(/\D/g, "");

    const res = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dob,
        gender,
        phone: phoneDigits,
        email: email.trim() || undefined,
        address: address.trim(),
        consent: true,
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      if (data.code === "duplicate_phone") {
        setStep("contact");
      }
      setError(data.error ?? "Registration failed. Please try again.");
      return;
    }

    if (data.reused_existing) {
      setMatchedModal({
        publicId: String(data.patient),
        verifyToken: data.verifyToken,
        matchedBy: data.matched_by ?? "existing record",
        message:
          data.message ??
          "We matched your details to an existing patient profile. No new record was created.",
      });
      return;
    }

    if (data.verifyToken) {
      storeVerifyToken(data.verifyToken);
    }
    setSuccessPublicId(String(data.patient));
    setSuccessVerifyToken(data.verifyToken ?? null);
  }

  if (successPublicId) {
    return (
      <SuccessCard
        reference="Registered"
        message="Registration complete."
        primaryCta={{
          label: "Check in now",
          href: successVerifyToken ? "/checkin?tab=walk-in" : "/patient-search",
        }}
        secondaryCta={{
          label: "Book appointment",
          href: `/appointments?publicId=${successPublicId}`,
        }}
      />
    );
  }

  return (
    <>
      <CareqCard className="overflow-hidden">
        <CareqCardHeader
          title="Patient Information"
          description="Complete each step to register."
        >
          <p className="text-body-sm text-on-surface-variant mt-2">
            Been here before?{" "}
            <Link href="/patient-search" className="text-primary hover:underline font-medium">
              Find Patient
            </Link>{" "}
            first instead of registering again.
          </p>
        </CareqCardHeader>

        <div className="px-6 py-5">
          <StepIndicator
            className="mb-6"
            steps={[
              { id: "personal", label: "Personal" },
              { id: "contact", label: "Contact" },
              { id: "consent", label: "Consent" },
            ]}
            currentStep={step}
          />
          {error && <FormError message={error} />}

          <div className="space-y-6">
            {step === "personal" && (
              <fieldset className="space-y-4">
                <legend className="text-label-md font-semibold text-on-surface mb-2">
                  Personal details
                </legend>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FormLabel htmlFor="firstName" required>
                      First Name
                    </FormLabel>
                    <FormInput
                      id="firstName"
                      name="firstName"
                      type="text"
                      required
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                  </div>
                  <div>
                    <FormLabel htmlFor="lastName" required>
                      Last Name
                    </FormLabel>
                    <FormInput
                      id="lastName"
                      name="lastName"
                      type="text"
                      required
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FormLabel htmlFor="dob" required>
                      Date of Birth
                    </FormLabel>
                    <FormInput
                      id="dob"
                      name="dob"
                      type="date"
                      required
                      min="1900-01-01"
                      max={new Date().toISOString().slice(0, 10)}
                      value={dob}
                      onChange={(e) => setDob(e.target.value)}
                    />
                  </div>
                  <div>
                    <FormLabel htmlFor="gender" required>
                      Gender
                    </FormLabel>
                    <FormSelect
                      id="gender"
                      value={gender}
                      onChange={(e) => setGender(e.target.value)}
                      required
                    >
                      <option value="" disabled>
                        Select gender
                      </option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </FormSelect>
                  </div>
                </div>
              </fieldset>
            )}

            {step === "contact" && (
              <fieldset className="space-y-4">
                <legend className="text-label-md font-semibold text-on-surface mb-2">
                  Contact
                </legend>
                <div>
                  <FormLabel htmlFor="phone" required>
                    Phone Number
                  </FormLabel>
                  <FormInput
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    required
                    placeholder="09XXXXXXXXX"
                    maxLength={11}
                    value={phone}
                    onChange={(e) =>
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))
                    }
                  />
                </div>
                <div>
                  <FormLabel htmlFor="email">
                    Email <span className="text-on-surface-variant font-normal">(optional)</span>
                  </FormLabel>
                  <FormInput
                    id="email"
                    name="email"
                    type="email"
                    placeholder="you@example.com"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div>
                  <FormLabel htmlFor="address" required>
                    Area
                  </FormLabel>
                  <FormInput
                    id="address"
                    name="address"
                    type="text"
                    required
                    maxLength={100}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
              </fieldset>
            )}

            {step === "consent" && (
              <fieldset>
                <legend className="text-label-md font-semibold text-on-surface mb-2">
                  Consent
                </legend>
                <label className="flex items-start gap-2 text-body-sm text-foreground cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    className="mt-1 rounded border-input"
                  />
                  <span>
                    I consent to the storage and processing of my personal data.{" "}
                    <span className="text-destructive">*</span>
                  </span>
                </label>
                <div className="mt-4 rounded-lg border border-outline-variant bg-surface-container-low p-3 text-body-sm text-on-surface-variant">
                  <p>
                    <strong className="text-on-surface">{firstName} {lastName}</strong>
                  </p>
                  <p>DOB: {dob} · {phone}</p>
                  <p>{address}</p>
                </div>
              </fieldset>
            )}

            <div className="flex flex-wrap gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={goBack}>
                {step === "personal" ? "Back" : "Previous"}
              </Button>
              {step !== "consent" ? (
                <CareqButton type="button" onClick={goNext}>
                  Next
                </CareqButton>
              ) : (
                <CareqButton
                  type="button"
                  disabled={loading || !consent}
                  onClick={submitRegistration}
                  className="cursor-pointer"
                >
                  {loading ? "Registering..." : "Complete Registration"}
                </CareqButton>
              )}
            </div>
          </div>
        </div>
      </CareqCard>

      <ConfirmDialog
        open={!!matchedModal}
        onOpenChange={(open) => !open && setMatchedModal(null)}
        title="Profile already on file"
        description={matchedModal?.message}
        className="border-2 border-primary"
        footer={
          <>
            <Button variant="outline" asChild>
              <Link href="/patient-search">Find Patient</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href={`/appointments?publicId=${matchedModal?.publicId}`}>
                <Calendar className="h-4 w-4" />
                Book Appointment
              </Link>
            </Button>
            <CareqButton
              onClick={() =>
                matchedModal &&
                navigateAfterRegister(matchedModal.publicId, matchedModal.verifyToken)
              }
            >
              <LogIn className="h-4 w-4" />
              Check In Today
            </CareqButton>
          </>
        }
      >
        {matchedModal && (
          <div className="flex items-start gap-3 rounded-lg bg-primary/5 p-3 text-body-sm text-on-surface-variant">
            <User className="h-5 w-5 text-primary shrink-0" />
            <p>
              <strong className="text-foreground">Profile reference:</strong>{" "}
              {matchedModal.publicId.slice(0, 8)}…{" "}
              · <strong className="text-foreground">Matched by:</strong> {matchedModal.matchedBy}
            </p>
          </div>
        )}
      </ConfirmDialog>

    </>
  );
}

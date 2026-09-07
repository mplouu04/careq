"use client";

import { useMemo, useState } from "react";
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
  FormHelperText,
  StepIndicator,
  SuccessCard,
} from "@/components/careq";
import { Button } from "@/components/ui/button";
import { storeVerifyToken } from "@/lib/verify-session";
import { getClinicTodayYmd } from "@/lib/datetime";
import {
  PATIENT_NAME_PATTERN_HTML,
  maxDobForMinAge,
  parseGuestPatientFieldErrors,
} from "@/lib/schemas/patient";
import { cn } from "@/lib/utils";
import { EmailVerifyField } from "@/components/patient/EmailVerifyField";
import { ConsentLegalLinks } from "@/components/legal/ConsentLegalLinks";

type RegStep = "personal" | "contact" | "consent";

export function RegistrationForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [step, setStep] = useState<RegStep>("personal");
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dob, setDob] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [emailProofToken, setEmailProofToken] = useState<string | null>(null);
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

  const todayYmd = getClinicTodayYmd();
  const maxDobYmd = useMemo(() => maxDobForMinAge(todayYmd), [todayYmd]);

  function navigateAfterRegister(_publicId: string, token?: string) {
    if (token) storeVerifyToken(token);
    if (redirectTo) {
      router.push(redirectTo);
      return;
    }
    if (token) {
      router.push("/checkin?tab=walk-in");
    } else {
      router.push("/patient-search");
    }
  }

  function clearFieldError(key: string) {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function guestPayload() {
    return {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      dob,
      gender,
      phone: phone.trim(),
      address: address.trim(),
      consent,
      email: email.trim(),
    };
  }

  function validatePersonal(): boolean {
    const all = parseGuestPatientFieldErrors(guestPayload());
    const personalKeys = ["firstName", "lastName", "dob", "gender"] as const;
    const errors: Record<string, string> = {};
    for (const key of personalKeys) {
      if (all[key]) errors[key] = all[key];
    }
    setFieldErrors(errors);
    setError(Object.keys(errors).length ? "Please fix the highlighted fields." : null);
    return Object.keys(errors).length === 0;
  }

  function validateContact(): boolean {
    const all = parseGuestPatientFieldErrors(guestPayload());
    const contactKeys = ["phone", "address", "email"] as const;
    const errors: Record<string, string> = {};
    for (const key of contactKeys) {
      if (all[key]) errors[key] = all[key];
    }
    if (!errors.email && !emailProofToken) {
      errors.email = "Verify your email with the code we send";
    }
    setFieldErrors(errors);
    setError(Object.keys(errors).length ? "Please fix the highlighted fields." : null);
    return Object.keys(errors).length === 0;
  }

  function goNext() {
    if (step === "personal" && validatePersonal()) setStep("contact");
    else if (step === "contact" && validateContact()) setStep("consent");
  }

  function goBack() {
    setError(null);
    setFieldErrors({});
    if (step === "contact") setStep("personal");
    else if (step === "consent") setStep("contact");
    else router.push("/visit");
  }

  async function submitRegistration() {
    if (!consent) {
      setFieldErrors({ consent: "Consent is required" });
      setError("You must consent to continue.");
      return;
    }
    if (!validatePersonal()) {
      setStep("personal");
      return;
    }
    if (!validateContact()) {
      setStep("contact");
      return;
    }

    setLoading(true);
    setError(null);
    const payload = guestPayload();
    const phoneDigits = payload.phone.replace(/\D/g, "");

    try {
      const res = await fetch("/api/patients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: payload.firstName,
          lastName: payload.lastName,
          dob: payload.dob,
          gender: payload.gender,
          phone: phoneDigits,
          email: payload.email,
          emailProofToken,
          address: payload.address,
          consent: true,
        }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        if ((data as { code?: string }).code === "duplicate_phone") {
          setStep("contact");
        }
        setError(
          (data as { error?: string }).error ?? "Registration failed. Please try again."
        );
        return;
      }

      await handleRegistrationSuccess(data as Record<string, unknown>);
    } catch {
      setError("Registration failed. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleRegistrationSuccess(data: Record<string, unknown>) {
    if (data.reused_existing) {
      setMatchedModal({
        publicId: String(data.patient),
        verifyToken: data.verifyToken as string | undefined,
        matchedBy: (data.matched_by as string) ?? "existing record",
        message:
          (data.message as string) ??
          "We matched your details to an existing patient profile. No new record was created.",
      });
      return;
    }

    if (data.verifyToken) {
      storeVerifyToken(String(data.verifyToken));
    }
    setSuccessPublicId(String(data.patient));
    setSuccessVerifyToken(
      data.verifyToken != null ? String(data.verifyToken) : null
    );
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
          href: "/appointments",
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
                      minLength={2}
                      maxLength={50}
                      pattern={PATIENT_NAME_PATTERN_HTML}
                      value={firstName}
                      onChange={(e) => {
                        clearFieldError("firstName");
                        setFirstName(e.target.value);
                      }}
                      aria-invalid={!!fieldErrors.firstName}
                      aria-describedby={fieldErrors.firstName ? "firstName-error" : undefined}
                      className={cn(fieldErrors.firstName && "border-destructive")}
                    />
                    {fieldErrors.firstName && (
                      <FormHelperText id="firstName-error" className="text-destructive">
                        {fieldErrors.firstName}
                      </FormHelperText>
                    )}
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
                      minLength={2}
                      maxLength={50}
                      pattern={PATIENT_NAME_PATTERN_HTML}
                      value={lastName}
                      onChange={(e) => {
                        clearFieldError("lastName");
                        setLastName(e.target.value);
                      }}
                      aria-invalid={!!fieldErrors.lastName}
                      aria-describedby={fieldErrors.lastName ? "lastName-error" : undefined}
                      className={cn(fieldErrors.lastName && "border-destructive")}
                    />
                    {fieldErrors.lastName && (
                      <FormHelperText id="lastName-error" className="text-destructive">
                        {fieldErrors.lastName}
                      </FormHelperText>
                    )}
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
                      max={maxDobYmd}
                      value={dob}
                      onChange={(e) => {
                        clearFieldError("dob");
                        setDob(e.target.value);
                      }}
                      aria-invalid={!!fieldErrors.dob}
                      aria-describedby={fieldErrors.dob ? "dob-error" : undefined}
                      className={cn(fieldErrors.dob && "border-destructive")}
                    />
                    {fieldErrors.dob && (
                      <FormHelperText id="dob-error" className="text-destructive">
                        {fieldErrors.dob}
                      </FormHelperText>
                    )}
                  </div>
                  <div>
                    <FormLabel htmlFor="gender" required>
                      Gender
                    </FormLabel>
                    <FormSelect
                      id="gender"
                      value={gender}
                      onChange={(e) => {
                        clearFieldError("gender");
                        setGender(e.target.value);
                      }}
                      required
                      aria-invalid={!!fieldErrors.gender}
                      aria-describedby={fieldErrors.gender ? "gender-error" : undefined}
                      className={cn(fieldErrors.gender && "border-destructive")}
                    >
                      <option value="" disabled>
                        Select gender
                      </option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </FormSelect>
                    {fieldErrors.gender && (
                      <FormHelperText id="gender-error" className="text-destructive">
                        {fieldErrors.gender}
                      </FormHelperText>
                    )}
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
                    pattern="09[0-9]{9}"
                    value={phone}
                    onChange={(e) => {
                      clearFieldError("phone");
                      setPhone(e.target.value.replace(/\D/g, "").slice(0, 11));
                    }}
                    aria-invalid={!!fieldErrors.phone}
                    aria-describedby={fieldErrors.phone ? "phone-error" : "phone-hint"}
                    className={cn(fieldErrors.phone && "border-destructive")}
                  />
                  {fieldErrors.phone ? (
                    <FormHelperText id="phone-error" className="text-destructive">
                      {fieldErrors.phone}
                    </FormHelperText>
                  ) : (
                    <FormHelperText id="phone-hint">
                      11-digit mobile number starting with 09
                    </FormHelperText>
                  )}
                </div>
                <EmailVerifyField
                  email={email}
                  onEmailChange={setEmail}
                  emailProofToken={emailProofToken}
                  onProofChange={setEmailProofToken}
                  emailError={fieldErrors.email}
                  onClearEmailError={() => clearFieldError("email")}
                />
                <div>
                  <FormLabel htmlFor="address" required>
                    Address
                  </FormLabel>
                  <FormInput
                    id="address"
                    name="address"
                    type="text"
                    required
                    minLength={10}
                    maxLength={255}
                    value={address}
                    onChange={(e) => {
                      clearFieldError("address");
                      setAddress(e.target.value);
                    }}
                    aria-invalid={!!fieldErrors.address}
                    aria-describedby={fieldErrors.address ? "address-error" : undefined}
                    className={cn(fieldErrors.address && "border-destructive")}
                  />
                  {fieldErrors.address && (
                    <FormHelperText id="address-error" className="text-destructive">
                      {fieldErrors.address}
                    </FormHelperText>
                  )}
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
                    onChange={(e) => {
                      clearFieldError("consent");
                      setConsent(e.target.checked);
                    }}
                    className="mt-1 rounded border-input"
                  />
                  <span>
                    I understand my personal data will be used for clinic registration, appointments,
                    queue management, and related transactional emails (verification and reminders), as
                    described in the Privacy Notice.{" "}
                    <span className="text-destructive">*</span>
                    <br />
                    <ConsentLegalLinks className="text-body-sm text-on-surface-variant" />
                  </span>
                </label>
                {fieldErrors.consent && (
                  <FormHelperText className="text-destructive">{fieldErrors.consent}</FormHelperText>
                )}
                <div className="mt-4 rounded-lg border border-outline-variant bg-surface-container-low p-3 text-body-sm text-on-surface-variant">
                  <p>
                    <strong className="text-on-surface">
                      {firstName} {lastName}
                    </strong>
                  </p>
                  <p>
                    DOB: {dob} · {phone}
                  </p>
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
            <Button
              variant="outline"
              onClick={() => {
                if (matchedModal?.verifyToken) {
                  storeVerifyToken(matchedModal.verifyToken);
                }
                router.push("/appointments");
              }}
            >
              <Calendar className="h-4 w-4" />
              Book Appointment
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
              {matchedModal.publicId.slice(0, 8)}… ·{" "}
              <strong className="text-foreground">Matched by:</strong> {matchedModal.matchedBy}
            </p>
          </div>
        )}
      </ConfirmDialog>
    </>
  );
}

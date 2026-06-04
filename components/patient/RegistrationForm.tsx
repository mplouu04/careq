"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { User, CheckCircle2, Calendar, LogIn } from "lucide-react";
import {
  CareqCard,
  CareqButton,
  ConfirmDialog,
  CareqCardHeader,
  FormLabel,
  FormInput,
  FormSelect,
  FormError,
} from "@/components/careq";
import { Button } from "@/components/ui/button";

export function RegistrationForm({ redirectTo }: { redirectTo?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [gender, setGender] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [matchedModal, setMatchedModal] = useState<{
    patientId: string;
    matchedBy: string;
    message: string;
  } | null>(null);
  const [successModal, setSuccessModal] = useState<{ patientId: string } | null>(null);

  function navigateAfterRegister(patientId: string) {
    if (redirectTo) {
      router.push(`${redirectTo}?patientId=${patientId}`);
    } else {
      router.push(`/checkin?patientId=${patientId}`);
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);

    const phoneRaw = String(fd.get("phone") ?? "");
    const phoneDigits = phoneRaw.replace(/\D/g, "");
    if (phoneDigits.length !== 11) {
      setError("Phone number must be exactly 11 digits (e.g. 09XXXXXXXXX).");
      setLoading(false);
      return;
    }

    const dobRaw = String(fd.get("dob") ?? "");
    const dobYear = parseInt(dobRaw.slice(0, 4), 10);
    const currentYear = new Date().getFullYear();
    if (!dobRaw || isNaN(dobYear) || dobYear < 1900 || dobYear > currentYear) {
      setError(`Date of birth must be a valid date between 1900 and ${currentYear}.`);
      setLoading(false);
      return;
    }

    const res = await fetch("/api/patients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: fd.get("firstName"),
        lastName: fd.get("lastName"),
        dob: fd.get("dob"),
        gender,
        phone: phoneDigits,
        email: fd.get("email") || undefined,
        address: fd.get("address"),
        consent: fd.get("consent") === "on",
      }),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error ?? "Registration failed. Please try again.");
      return;
    }

    if (data.reused_existing) {
      setMatchedModal({
        patientId: String(data.patient),
        matchedBy: data.matched_by ?? "existing record",
        message:
          data.message ??
          "We matched your details to an existing patient profile. No new record was created.",
      });
      return;
    }

    setSuccessModal({ patientId: String(data.patient) });
  }

  return (
    <>
      <CareqCard className="overflow-hidden">
        <CareqCardHeader
          title="Patient Information"
          description="Please fill out all required fields."
        >
          <p className="text-body-sm text-muted-foreground mt-2">
            Been here before?{" "}
            <Link href="/patient-search" className="text-primary hover:underline font-medium">
              Find Patient
            </Link>{" "}
            first instead of registering again.
          </p>
        </CareqCardHeader>

        <div className="px-6 py-5">
          {error && <FormError message={error} />}

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <FormLabel htmlFor="firstName" required>
                  First Name
                </FormLabel>
                <FormInput id="firstName" name="firstName" type="text" required />
              </div>
              <div>
                <FormLabel htmlFor="lastName" required>
                  Last Name
                </FormLabel>
                <FormInput id="lastName" name="lastName" type="text" required />
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
                <input type="hidden" name="gender" value={gender} />
              </div>
            </div>

            <div>
              <FormLabel htmlFor="phone" required>
                Phone Number
              </FormLabel>
              <FormInput
                id="phone"
                name="phone"
                type="tel"
                required
                placeholder="09XXXXXXXXX"
                maxLength={11}
                inputMode="numeric"
                onInput={(e) => {
                  const t = e.currentTarget;
                  t.value = t.value.replace(/\D/g, "").slice(0, 11);
                }}
              />
            </div>

            <div>
              <FormLabel htmlFor="email">
                Email <span className="text-muted-foreground font-normal">(optional)</span>
              </FormLabel>
              <FormInput
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <FormLabel htmlFor="address" required>
                Area
              </FormLabel>
              <FormInput id="address" name="address" type="text" required maxLength={100} />
            </div>

            <label className="flex items-start gap-2 text-body-sm text-foreground cursor-pointer">
              <input type="checkbox" name="consent" required className="mt-1 rounded border-input" />
              <span>
                I consent to the storage and processing of my personal data.{" "}
                <span className="text-destructive">*</span>
              </span>
            </label>

            <div className="flex flex-wrap gap-3 justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => router.push("/visit")}>
                Back
              </Button>
              <CareqButton type="submit" disabled={loading || !gender}>
                {loading ? "Registering..." : "Complete Registration and Check In"}
              </CareqButton>
            </div>
          </form>
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
              <Link href={`/appointments?patientId=${matchedModal?.patientId}`}>
                <Calendar className="h-4 w-4" />
                Book Appointment
              </Link>
            </Button>
            <CareqButton
              onClick={() => matchedModal && navigateAfterRegister(matchedModal.patientId)}
            >
              <LogIn className="h-4 w-4" />
              Check In Today
            </CareqButton>
          </>
        }
      >
        {matchedModal && (
          <div className="flex items-start gap-3 rounded-lg bg-primary/5 p-3 text-body-sm text-muted-foreground">
            <User className="h-5 w-5 text-primary shrink-0" />
            <p>
              <strong className="text-foreground">Patient ID:</strong> {matchedModal.patientId}{" "}
              · <strong className="text-foreground">Matched by:</strong> {matchedModal.matchedBy}
            </p>
          </div>
        )}
      </ConfirmDialog>

      <ConfirmDialog
        open={!!successModal}
        onOpenChange={(open) => !open && setSuccessModal(null)}
        title="Registration Complete!"
        description="Thank you for registering with our clinic."
        showCloseButton
        footer={
          <>
            <Button variant="outline" asChild>
              <Link href={`/appointments?patientId=${successModal?.patientId}`}>
                <Calendar className="h-4 w-4" />
                Book Appointment
              </Link>
            </Button>
            <CareqButton
              onClick={() => successModal && navigateAfterRegister(successModal.patientId)}
            >
              <CheckCircle2 className="h-4 w-4" />
              Check In Today
            </CareqButton>
          </>
        }
      >
        <div className="text-center py-2">
          <div className="icon-circle bg-status-called/15 text-status-called mx-auto mb-3">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="text-left rounded-lg border border-secondary-container bg-secondary-container/40 p-3 text-body-sm text-on-secondary-container">
            <p className="font-semibold mb-1">Next Steps</p>
            <p>
              <strong>Check In Today</strong> if you are here right now for a walk-in visit.
            </p>
            <p className="mt-1">
              <strong>Book Appointment</strong> to schedule a future visit.
            </p>
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}

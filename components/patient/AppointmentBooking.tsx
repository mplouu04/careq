"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { appointmentApi } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
  isAfter,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfMonth,
  subMonths,
} from "date-fns";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Stethoscope,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CAREQ_PRIMARY } from "@/lib/design-tokens";
import {
  PATIENT_NAME_PATTERN_HTML,
  parseGuestPatientFieldErrors,
} from "@/lib/schemas/patient";
import { CareqButton } from "@/components/careq/careq-button";
import { DoctorCardsSkeleton } from "@/components/careq/skeletons";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StepIndicator } from "@/components/careq/step-indicator";
import {
  FormHelperText,
  FormInput,
  FormLabel,
  FormSelect,
} from "@/components/careq/form-primitives";
import { TimeSlotPicker } from "@/components/patient/TimeSlotPicker";
import {
  BOOKING_INITIAL_STATE,
  BOOKING_STEPS,
  type BookingDoctor,
  type BookingState,
  useAppointmentBookingCatalog,
  useBookingViewMonth,
} from "@/components/patient/useAppointmentBookingCatalog";

const AVATAR_COLORS = [CAREQ_PRIMARY, "#1a5fb4", "#003d99", "#2563c4"];

function formatTime12h(t: string): string {
  const [hStr, mStr] = t.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${mStr ?? "00"} ${ampm}`;
}

function parseYmd(ymd: string): Date {
  return new Date(`${ymd}T12:00:00`);
}

function toYmd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function isWeekend(day: Date): boolean {
  const dow = getDay(day);
  return dow === 0 || dow === 6;
}

function doctorName(d: BookingDoctor): string {
  return `Dr. ${d.first_name} ${d.last_name}`;
}

function doctorInitials(d: BookingDoctor): string {
  return `${d.first_name.charAt(0)}${d.last_name.charAt(0)}`.toUpperCase();
}

export function AppointmentBooking() {
  const params = useSearchParams();
  const publicId = params.get("publicId");

  const [state, setState] = useState<BookingState>(BOOKING_INITIAL_STATE);
  const { viewMonth, setViewMonth } = useBookingViewMonth();
  const [confirming, setConfirming] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const {
    queryClient,
    todayYmd,
    maxDobYmd,
    maxDate,
    doctors,
    types,
    doctorsLoading,
    selectedDoctor,
    selectedType,
    duration,
    slots,
    slotsLoading,
  } = useAppointmentBookingCatalog(state);

  const todayDate = parseYmd(todayYmd);
  const maxDateObj = parseYmd(maxDate);

  useEffect(() => {
    if (!state.doctorId || doctorsLoading) return;
    const selected = doctors.find((d) => d.id === state.doctorId);
    if (!selected || !selected.is_active) {
      setState((s) => ({
        ...s,
        doctorId: "",
        date: "",
        time: "",
        step: s.step > 1 ? 1 : s.step,
      }));
      toast.message("The selected doctor is no longer available. Please choose another.");
    }
  }, [doctors, doctorsLoading, state.doctorId]);

  const goStep = (step: number) => {
    setState((s) => ({ ...s, step }));
  };

  const patch = (partial: Partial<BookingState>) => {
    setState((s) => ({ ...s, ...partial }));
  };

  const calendarDays = useMemo(() => {
    const start = startOfMonth(viewMonth);
    const end = endOfMonth(viewMonth);
    return eachDayOfInterval({ start, end });
  }, [viewMonth]);

  const leadingBlanks = getDay(startOfMonth(viewMonth));

  const isDayDisabled = (day: Date) => {
    if (isBefore(day, todayDate) && !isSameDay(day, todayDate)) return true;
    if (isAfter(day, maxDateObj)) return true;
    return isWeekend(day);
  };

  const handleDateSelect = (ymd: string, day: Date) => {
    if (isWeekend(day)) {
      toast.error("Appointments are only available on weekdays (Mon–Fri).");
      return;
    }
    patch({ date: ymd, time: "" });
  };

  const resetFlow = () => {
    setState({ ...BOOKING_INITIAL_STATE, step: 1 });
    setViewMonth(startOfMonth(new Date()));
    setFieldErrors({});
  };

  const guestPayload = () => ({
    firstName: state.fname.trim(),
    lastName: state.lname.trim(),
    dob: state.dob,
    gender: state.gender,
    phone: state.phone.trim(),
    address: state.address.trim(),
    consent: state.consent,
    email: state.email.trim(),
  });

  const validateGuestDetails = (): boolean => {
    const errors = parseGuestPatientFieldErrors(guestPayload());
    if (!state.consent) {
      errors.consent = "Consent is required";
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const clearFieldError = (key: string) => {
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleStep3Continue = () => {
    if (!publicId && !validateGuestDetails()) return;
    if (!state.termsAgreed) {
      toast.error("Agree to clinic terms to continue.");
      return;
    }
    goStep(4);
  };

  const handleConfirm = async () => {
    if (!state.termsAgreed) {
      toast.error("Agree to clinic terms to continue.");
      return;
    }
    if (!publicId && !validateGuestDetails()) {
      toast.error("Please fix the highlighted fields.");
      goStep(3);
      return;
    }
    setConfirming(true);
    try {
      const payload: Record<string, unknown> = {
        preferredDoctor: state.doctorId,
        appointmentType: state.appTypeId,
        appointmentDate: state.date,
        appointmentTime: state.time,
        termsAgreement: "on",
        reason: state.reason.trim() || undefined,
      };

      if (publicId) {
        payload.patient_id = publicId;
      } else {
        const guest = guestPayload();
        payload.firstName = guest.firstName;
        payload.lastName = guest.lastName;
        payload.phone = guest.phone.replace(/\D/g, "");
        payload.dob = guest.dob;
        payload.gender = guest.gender;
        payload.address = guest.address;
        payload.consent = guest.consent;
        payload.email = guest.email;
      }

      const { ok, data } = await appointmentApi.book(payload);

      if (!ok) {
        if (data.code === "slot_unavailable") {
          toast.error(data.error ?? "That slot was just taken. Please choose another time.");
          await queryClient.invalidateQueries({
            queryKey: queryKeys.doctors.availability(
              state.doctorId,
              state.date,
              state.appTypeId,
              duration
            ),
          });
          patch({ step: 2, time: "" });
        } else {
          toast.error(data.error ?? "Booking failed");
        }
        return;
      }

      patch({ reference: data.appointmentID ?? "", step: 5 });
      void queryClient.invalidateQueries({ queryKey: queryKeys.doctors.all });
    } catch {
      toast.error("Booking failed. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  if (state.step === 5 && state.reference) {
    const dateLabel = state.date
      ? format(parseYmd(state.date), "EEE, MMM d")
      : "";
    return (
      <div className="max-w-lg mx-auto text-center py-8 px-4">
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Check className="h-8 w-8 text-primary" strokeWidth={2.5} aria-hidden />
        </div>
        <h2 className="text-headline-md text-on-surface mb-3">
          You&apos;re all booked!
        </h2>
        <p className="text-body-sm text-on-surface-variant mb-6">
          Save your reference code to track or manage your appointment.
        </p>
        <div className="inline-block rounded-xl border-2 border-dashed border-primary bg-primary/10 px-6 py-3 mb-8">
          <span className="font-mono text-headline-sm font-bold tracking-wider text-primary">
            {state.reference}
          </span>
        </div>
        <div className="flex flex-wrap justify-center gap-2 mb-8">
          {dateLabel && (
            <span className="rounded-full bg-primary/10 px-4 py-1.5 text-body-sm font-medium text-primary">
              {dateLabel}
            </span>
          )}
          {state.time && (
            <span className="rounded-full bg-primary/10 px-4 py-1.5 text-body-sm font-medium text-primary">
              {formatTime12h(state.time)}
            </span>
          )}
          {selectedDoctor && (
            <span className="rounded-full bg-primary/10 px-4 py-1.5 text-body-sm font-medium text-primary">
              {doctorName(selectedDoctor)}
            </span>
          )}
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 rounded-xl text-primary hover:bg-primary/10"
            asChild
          >
            <Link href="/my-appointments">Track appointment</Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="min-h-11 rounded-xl text-primary hover:bg-primary/10"
            onClick={resetFlow}
          >
            Book another appointment
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-body-sm text-on-surface-variant hover:text-primary transition-colors mb-6"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back
      </Link>

      <header className="mb-8">
        <h1 className="text-headline-md text-on-surface">
          Book an appointment
        </h1>
        <p className="text-body-md text-on-surface-variant mt-2">
          Choose your doctor, pick a time, and confirm your details in a few steps.
        </p>
        {publicId && (
          <p className="text-body-sm text-primary mt-2">
            Booking as a registered patient.
          </p>
        )}
      </header>

      <StepIndicator
        steps={BOOKING_STEPS}
        currentStep={String(state.step)}
        className="mb-10"
      />

      {/* Step 1: Doctor & visit type */}
      {state.step === 1 && (
        <section aria-labelledby="step-doctor">
          <h2 id="step-doctor" className="sr-only">
            Select a doctor and visit type
          </h2>

          {doctorsLoading ? (
            <DoctorCardsSkeleton count={3} className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" />
          ) : doctors.every((d) => !d.is_active) ? (
            <p className="text-body-sm text-on-surface-variant">
              No doctors available for booking right now.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.map((doctor, idx) => {
                const available = doctor.is_active;
                const selected = available && state.doctorId === doctor.id;
                return (
                  <button
                    key={doctor.id}
                    type="button"
                    disabled={!available}
                    onClick={() => {
                      if (!available) return;
                      patch({ doctorId: doctor.id, date: "", time: "" });
                    }}
                    className={cn(
                      "relative text-left rounded-xl border-2 p-5 transition-all",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      available
                        ? "hover:shadow-md"
                        : "cursor-not-allowed opacity-50",
                      selected
                        ? "border-primary bg-primary/10 shadow-sm"
                        : available
                          ? "border-outline-variant bg-surface-container-lowest"
                          : "border-outline-variant/60 bg-muted/40"
                    )}
                    aria-pressed={available ? selected : undefined}
                    aria-disabled={!available}
                  >
                    {selected && (
                      <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                        <Check className="h-3.5 w-3.5" aria-hidden />
                      </span>
                    )}
                    <div
                      className={cn(
                        "flex h-12 w-12 items-center justify-center rounded-full text-white font-semibold text-body-md mb-3",
                        !available && "grayscale"
                      )}
                      style={{
                        backgroundColor: AVATAR_COLORS[idx % AVATAR_COLORS.length],
                      }}
                      aria-hidden
                    >
                      {doctorInitials(doctor)}
                    </div>
                    <p className="font-semibold text-on-surface pr-8">
                      {doctorName(doctor)}
                    </p>
                    {!available && (
                      <p className="text-label-sm text-on-surface-variant mt-1">
                        Unavailable
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <div className="mt-8">
            <p className="text-body-sm font-medium text-on-surface mb-3">
              Visit type <span className="text-destructive">*</span>
            </p>
            {doctorsLoading ? (
              <Skeleton className="h-10 w-full max-w-md" />
            ) : types.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant">
                No appointment types configured.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {types.map((type) => {
                  const selected = state.appTypeId === String(type.id);
                  return (
                    <button
                      key={type.id}
                      type="button"
                      onClick={() =>
                        patch({
                          appTypeId: String(type.id),
                          date: "",
                          time: "",
                        })
                      }
                      className={cn(
                        "rounded-full px-4 py-2 text-body-sm font-medium border transition-colors min-h-[44px]",
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-outline-variant hover:border-primary/40 hover:bg-primary/5"
                      )}
                      aria-pressed={selected}
                    >
                      {type.name} ({type.duration} min)
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-8 flex justify-end">
            <CareqButton
              type="button"
              disabled={!state.doctorId || !state.appTypeId}
              className="px-8"
              onClick={() => goStep(2)}
            >
              Continue
            </CareqButton>
          </div>
        </section>
      )}

      {/* Step 2: Date & Time */}
      {state.step === 2 && selectedDoctor && (
        <section aria-labelledby="step-datetime">
          <h2 id="step-datetime" className="sr-only">
            Select date and time
          </h2>

          <p className="text-body-sm text-on-surface-variant mb-4">
            Weekdays only · Available through{" "}
            {format(maxDateObj, "MMM d, yyyy")}
          </p>

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setViewMonth((m) => subMonths(m, 1))}
                disabled={isBefore(endOfMonth(subMonths(viewMonth, 1)), todayDate)}
                className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-primary/10 text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Previous month"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-headline-sm text-on-surface">
                {format(viewMonth, "MMMM yyyy")}
              </span>
              <button
                type="button"
                onClick={() => setViewMonth((m) => addMonths(m, 1))}
                disabled={isAfter(startOfMonth(addMonths(viewMonth, 1)), maxDateObj)}
                className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-primary/10 text-primary transition-colors disabled:opacity-40 disabled:pointer-events-none"
                aria-label="Next month"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 mb-2">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div
                  key={d}
                  className="text-center text-label-sm font-medium text-on-surface-variant py-2"
                >
                  {d}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: leadingBlanks }).map((_, i) => (
                <div key={`blank-${i}`} aria-hidden />
              ))}
              {calendarDays.map((day) => {
                const ymd = toYmd(day);
                const disabled = isDayDisabled(day);
                const selected = state.date === ymd;
                const inMonth = isSameMonth(day, viewMonth);

                return (
                  <button
                    key={ymd}
                    type="button"
                    disabled={disabled || !inMonth}
                    onClick={() => handleDateSelect(ymd, day)}
                    className={cn(
                      "relative flex flex-col items-center justify-center h-10 w-full rounded-full text-body-sm transition-colors",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      disabled && "text-on-surface-variant/40 cursor-not-allowed",
                      !disabled && !selected && "hover:bg-primary/10 text-on-surface",
                      selected && "bg-primary text-white font-semibold"
                    )}
                    aria-label={format(day, "EEEE, MMMM d")}
                    aria-pressed={selected}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          </div>

          {state.date && (
            <div className="mt-8">
              <TimeSlotPicker
                slots={slots}
                selected={state.time}
                onSelect={(slot) => patch({ time: slot })}
                dateLabel={format(parseYmd(state.date), "EEEE, MMM d")}
                loading={slotsLoading}
              />
            </div>
          )}

          <div className="mt-8 flex justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-xl"
              onClick={() => goStep(1)}
            >
              Back
            </Button>
            <CareqButton
              type="button"
              disabled={!state.date || !state.time}
              className="px-8"
              onClick={() => goStep(3)}
            >
              Continue
            </CareqButton>
          </div>
        </section>
      )}

      {/* Step 3: Patient Details */}
      {state.step === 3 && (
        <section aria-labelledby="step-details">
          <h2 id="step-details" className="sr-only">
            Patient details
          </h2>

          <div className="space-y-6">
            <div>
              <FormLabel htmlFor="reason">
                Reason for visit{" "}
                <span className="text-on-surface-variant font-normal">(optional)</span>
              </FormLabel>
              <textarea
                id="reason"
                rows={3}
                value={state.reason}
                onChange={(e) => patch({ reason: e.target.value })}
                placeholder="Brief reason for the visit"
                className="mt-0 flex w-full rounded-lg border border-input bg-background px-4 py-3 text-body-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[88px]"
              />
            </div>

            {!publicId && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FormLabel htmlFor="fname" required>
                      First name
                    </FormLabel>
                    <FormInput
                      id="fname"
                      type="text"
                      required
                      minLength={2}
                      maxLength={50}
                      pattern={PATIENT_NAME_PATTERN_HTML}
                      value={state.fname}
                      onChange={(e) => {
                        clearFieldError("firstName");
                        patch({ fname: e.target.value });
                      }}
                      aria-invalid={!!fieldErrors.firstName}
                      aria-describedby={fieldErrors.firstName ? "fname-error" : undefined}
                      className={cn(fieldErrors.firstName && "border-destructive")}
                      autoComplete="given-name"
                    />
                    {fieldErrors.firstName && (
                      <FormHelperText id="fname-error" className="text-destructive">
                        {fieldErrors.firstName}
                      </FormHelperText>
                    )}
                  </div>
                  <div>
                    <FormLabel htmlFor="lname" required>
                      Last name
                    </FormLabel>
                    <FormInput
                      id="lname"
                      type="text"
                      required
                      minLength={2}
                      maxLength={50}
                      pattern={PATIENT_NAME_PATTERN_HTML}
                      value={state.lname}
                      onChange={(e) => {
                        clearFieldError("lastName");
                        patch({ lname: e.target.value });
                      }}
                      aria-invalid={!!fieldErrors.lastName}
                      aria-describedby={fieldErrors.lastName ? "lname-error" : undefined}
                      className={cn(fieldErrors.lastName && "border-destructive")}
                      autoComplete="family-name"
                    />
                    {fieldErrors.lastName && (
                      <FormHelperText id="lname-error" className="text-destructive">
                        {fieldErrors.lastName}
                      </FormHelperText>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FormLabel htmlFor="dob" required>
                      Date of birth
                    </FormLabel>
                    <FormInput
                      id="dob"
                      type="date"
                      required
                      min="1900-01-01"
                      max={maxDobYmd}
                      value={state.dob}
                      onChange={(e) => {
                        clearFieldError("dob");
                        patch({ dob: e.target.value });
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
                      required
                      value={state.gender}
                      onChange={(e) => {
                        clearFieldError("gender");
                        patch({ gender: e.target.value });
                      }}
                      aria-invalid={!!fieldErrors.gender}
                      aria-describedby={fieldErrors.gender ? "gender-error" : undefined}
                      className={cn(fieldErrors.gender && "border-destructive")}
                    >
                      <option value="">Select gender</option>
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

                <div>
                  <FormLabel htmlFor="address" required>
                    Address
                  </FormLabel>
                  <FormInput
                    id="address"
                    type="text"
                    required
                    minLength={10}
                    maxLength={255}
                    value={state.address}
                    onChange={(e) => {
                      clearFieldError("address");
                      patch({ address: e.target.value });
                    }}
                    aria-invalid={!!fieldErrors.address}
                    aria-describedby={fieldErrors.address ? "address-error" : undefined}
                    className={cn(fieldErrors.address && "border-destructive")}
                    autoComplete="street-address"
                  />
                  {fieldErrors.address && (
                    <FormHelperText id="address-error" className="text-destructive">
                      {fieldErrors.address}
                    </FormHelperText>
                  )}
                </div>

                <div>
                  <FormLabel htmlFor="phone" required>
                    Phone
                  </FormLabel>
                  <FormInput
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    required
                    placeholder="09XXXXXXXXX"
                    maxLength={11}
                    pattern="09[0-9]{9}"
                    value={state.phone}
                    onChange={(e) => {
                      clearFieldError("phone");
                      patch({ phone: e.target.value.replace(/\D/g, "").slice(0, 11) });
                    }}
                    aria-invalid={!!fieldErrors.phone}
                    aria-describedby={
                      fieldErrors.phone ? "phone-error" : "phone-hint"
                    }
                    className={cn(fieldErrors.phone && "border-destructive")}
                    autoComplete="tel"
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

                <div>
                  <FormLabel htmlFor="email" required>
                    Email
                  </FormLabel>
                  <FormInput
                    id="email"
                    type="email"
                    value={state.email}
                    onChange={(e) => {
                      clearFieldError("email");
                      patch({ email: e.target.value });
                    }}
                    aria-invalid={!!fieldErrors.email}
                    aria-describedby={
                      fieldErrors.email ? "email-error" : "email-hint"
                    }
                    className={cn(fieldErrors.email && "border-destructive")}
                    autoComplete="email"
                  />
                  {fieldErrors.email ? (
                    <FormHelperText id="email-error" className="text-destructive">
                      {fieldErrors.email}
                    </FormHelperText>
                  ) : (
                    <FormHelperText id="email-hint">
                      Required for appointment reminders
                    </FormHelperText>
                  )}
                </div>

                <div>
                  <label className="flex items-start gap-2 text-body-sm cursor-pointer min-h-[44px]">
                    <input
                      type="checkbox"
                      checked={state.consent}
                      onChange={(e) => {
                        clearFieldError("consent");
                        patch({ consent: e.target.checked });
                      }}
                      aria-invalid={!!fieldErrors.consent}
                      className="mt-1 rounded"
                    />
                    <span>
                      I consent to the storage and processing of my personal data.{" "}
                      <span className="text-destructive">*</span>
                    </span>
                  </label>
                  {fieldErrors.consent && (
                    <FormHelperText className="text-destructive">
                      {fieldErrors.consent}
                    </FormHelperText>
                  )}
                </div>
              </>
            )}

            <label className="flex items-start gap-2 text-body-sm cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={state.termsAgreed}
                onChange={(e) => patch({ termsAgreed: e.target.checked })}
                className="mt-1 rounded"
              />
              <span>
                I agree to clinic terms. <span className="text-destructive">*</span>
              </span>
            </label>
          </div>

          <div className="mt-8 flex justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-xl"
              onClick={() => goStep(2)}
            >
              Back
            </Button>
            <CareqButton
              type="button"
              disabled={!state.termsAgreed}
              className="px-8"
              onClick={handleStep3Continue}
            >
              Continue
            </CareqButton>
          </div>
        </section>
      )}

      {/* Step 4: Review & Confirm */}
      {state.step === 4 && selectedDoctor && (
        <section aria-labelledby="step-review">
          <h2 id="step-review" className="sr-only">
            Review and confirm
          </h2>

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest divide-y divide-outline-variant">
            <ReviewRow
              icon={<Stethoscope className="h-4 w-4" />}
              label="Doctor"
              value={doctorName(selectedDoctor)}
            />
            {selectedType && (
              <ReviewRow
                icon={<ClipboardList className="h-4 w-4" />}
                label="Visit type"
                value={`${selectedType.name} (${selectedType.duration} min)`}
              />
            )}
            <ReviewRow
              icon={<Calendar className="h-4 w-4" />}
              label="Date & time"
              value={
                state.date && state.time
                  ? `${format(parseYmd(state.date), "EEEE, MMMM d, yyyy")} at ${formatTime12h(state.time)}`
                  : ""
              }
            />
            {state.reason && (
              <ReviewRow
                icon={<ClipboardList className="h-4 w-4" />}
                label="Reason"
                value={state.reason}
              />
            )}
            <ReviewRow
              icon={<User className="h-4 w-4" />}
              label="Patient"
              value={
                publicId
                  ? "Registered patient (pre-selected)"
                  : `${state.fname} ${state.lname} · ${state.phone}`
              }
            />
          </div>

          <div className="mt-8 flex flex-col-reverse sm:flex-row sm:justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 rounded-xl text-primary hover:bg-primary/10"
              onClick={() => goStep(3)}
            >
              Edit
            </Button>
            <CareqButton
              type="button"
              disabled={confirming}
              className="px-8"
              onClick={handleConfirm}
            >
              {confirming ? "Confirming…" : "Confirm booking"}
            </CareqButton>
          </div>
        </section>
      )}
    </div>
  );
}

function ReviewRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-4 p-4 sm:p-5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-label-sm text-on-surface-variant uppercase tracking-wide">
          {label}
        </p>
        <p className="text-body-md text-on-surface mt-0.5">{value}</p>
      </div>
    </div>
  );
}

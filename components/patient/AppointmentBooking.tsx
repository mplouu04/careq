"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  format,
  getDay,
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
import {
  BOOKING_DOCTORS,
  BOOKING_REASONS,
  generateBookingReference,
} from "@/lib/booking-doctors";
import { getClinicTodayYmd } from "@/lib/datetime";
import { CareqButton } from "@/components/careq/careq-button";
import { Button } from "@/components/ui/button";
import { StepIndicator } from "@/components/careq/step-indicator";

type BookingState = {
  step: number;
  doctorId: string;
  date: string;
  time: string;
  reason: string;
  fname: string;
  lname: string;
  phone: string;
  email: string;
  notes: string;
  reference: string;
};

const INITIAL_STATE: BookingState = {
  step: 1,
  doctorId: "",
  date: "",
  time: "",
  reason: "",
  fname: "",
  lname: "",
  phone: "",
  email: "",
  notes: "",
  reference: "",
};

const STEPS = [
  { id: "1", label: "Doctor" },
  { id: "2", label: "Date & time" },
  { id: "3", label: "Details" },
  { id: "4", label: "Review" },
];

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

function isDoctorAvailableToday(unavailableDays: number[]): boolean {
  const today = getDay(new Date());
  return !unavailableDays.includes(today);
}

export function AppointmentBooking() {
  const [state, setState] = useState<BookingState>(INITIAL_STATE);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [confirming, setConfirming] = useState(false);

  const selectedDoctor = BOOKING_DOCTORS.find((d) => d.id === state.doctorId);
  const todayYmd = getClinicTodayYmd();
  const todayDate = parseYmd(todayYmd);

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
    if (!selectedDoctor) return true;
    if (isBefore(day, todayDate) && !isSameDay(day, todayDate)) return true;
    return selectedDoctor.unavailableDays.includes(getDay(day));
  };

  const isDayAvailable = (day: Date) => {
    if (isDayDisabled(day)) return false;
    return selectedDoctor!.slots.some((s) => !selectedDoctor!.takenSlots.includes(s));
  };

  const resetFlow = () => {
    setState(INITIAL_STATE);
    setViewMonth(startOfMonth(new Date()));
  };

  const handleConfirm = async () => {
    setConfirming(true);
    await new Promise((r) => setTimeout(r, 600));
    patch({ reference: generateBookingReference(), step: 5 });
    setConfirming(false);
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
              {selectedDoctor.name}
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 rounded-xl text-primary hover:bg-primary/10"
          onClick={resetFlow}
        >
          Book another appointment
        </Button>
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
      </header>

      <StepIndicator
        steps={STEPS}
        currentStep={String(state.step)}
        className="mb-10"
      />

      {/* Step 1: Doctor */}
      {state.step === 1 && (
        <section aria-labelledby="step-doctor">
          <h2 id="step-doctor" className="sr-only">
            Select a doctor
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BOOKING_DOCTORS.map((doctor) => {
              const selected = state.doctorId === doctor.id;
              const availableToday = isDoctorAvailableToday(doctor.unavailableDays);
              return (
                <button
                  key={doctor.id}
                  type="button"
                  onClick={() =>
                    patch({ doctorId: doctor.id, date: "", time: "" })
                  }
                  className={cn(
                    "relative text-left rounded-xl border-2 p-5 transition-all",
                    "hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                    selected
                      ? "border-primary bg-primary/10 shadow-sm"
                      : "border-outline-variant bg-surface-container-lowest"
                  )}
                  aria-pressed={selected}
                >
                  {selected && (
                    <span className="absolute top-3 right-3 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    </span>
                  )}
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-full text-white font-semibold text-body-md mb-3"
                    style={{ backgroundColor: doctor.avatarColor }}
                    aria-hidden
                  >
                    {doctor.initials}
                  </div>
                  <p className="font-semibold text-on-surface pr-8">{doctor.name}</p>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">
                    {doctor.spec}
                  </p>
                  {availableToday && (
                    <span className="inline-block mt-3 rounded-full bg-primary/10 px-2.5 py-0.5 text-label-sm font-medium text-primary">
                      Available today
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex justify-end">
            <CareqButton
              type="button"
              disabled={!state.doctorId}
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

          <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => setViewMonth((m) => subMonths(m, 1))}
                className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-primary/10 text-primary transition-colors"
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
                className="flex h-10 w-10 items-center justify-center rounded-lg hover:bg-primary/10 text-primary transition-colors"
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
                const available = isDayAvailable(day);
                const selected = state.date === ymd;
                const inMonth = isSameMonth(day, viewMonth);

                return (
                  <button
                    key={ymd}
                    type="button"
                    disabled={disabled || !inMonth}
                    onClick={() => patch({ date: ymd, time: "" })}
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
                    {available && !selected && (
                      <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-primary" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {state.date && (
            <div className="mt-8">
              <h3 className="text-headline-sm text-on-surface mb-4">
                Available times — {format(parseYmd(state.date), "EEEE, MMM d")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {selectedDoctor.slots.map((slot) => {
                  const taken = selectedDoctor.takenSlots.includes(slot);
                  const selected = state.time === slot;
                  return (
                    <button
                      key={slot}
                      type="button"
                      disabled={taken}
                      onClick={() => patch({ time: slot })}
                      className={cn(
                        "rounded-full px-4 py-2 text-body-sm font-medium border transition-colors min-h-[44px]",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        taken &&
                          "border-outline-variant bg-muted text-on-surface-variant/50 line-through cursor-not-allowed",
                        !taken &&
                          !selected &&
                          "border-primary/30 text-on-surface hover:bg-primary/10",
                        selected && "border-primary bg-primary text-white"
                      )}
                      aria-pressed={selected}
                    >
                      {formatTime12h(slot)}
                    </button>
                  );
                })}
              </div>
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
              <p className="text-body-sm font-medium text-on-surface mb-3">
                Reason for visit <span className="text-destructive">*</span>
              </p>
              <div className="flex flex-wrap gap-2">
                {BOOKING_REASONS.map((reason) => {
                  const selected = state.reason === reason;
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => patch({ reason })}
                      className={cn(
                        "rounded-full px-4 py-2 text-body-sm font-medium border transition-colors min-h-[44px]",
                        selected
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-outline-variant hover:border-primary/40 hover:bg-primary/5"
                      )}
                      aria-pressed={selected}
                    >
                      {reason}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label htmlFor="notes" className="text-body-sm font-medium text-on-surface">
                Additional notes <span className="text-on-surface-variant">(optional)</span>
              </label>
              <textarea
                id="notes"
                rows={3}
                value={state.notes}
                onChange={(e) => patch({ notes: e.target.value })}
                placeholder="Anything else we should know?"
                className="mt-2 flex w-full rounded-xl border border-input bg-background px-4 py-3 text-body-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[88px]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="fname" className="text-body-sm font-medium text-on-surface">
                  First name <span className="text-destructive">*</span>
                </label>
                <input
                  id="fname"
                  type="text"
                  value={state.fname}
                  onChange={(e) => patch({ fname: e.target.value })}
                  className="mt-2 flex w-full rounded-xl border border-input bg-background px-4 py-3 text-body-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
                  autoComplete="given-name"
                />
              </div>
              <div>
                <label htmlFor="lname" className="text-body-sm font-medium text-on-surface">
                  Last name <span className="text-destructive">*</span>
                </label>
                <input
                  id="lname"
                  type="text"
                  value={state.lname}
                  onChange={(e) => patch({ lname: e.target.value })}
                  className="mt-2 flex w-full rounded-xl border border-input bg-background px-4 py-3 text-body-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
                  autoComplete="family-name"
                />
              </div>
            </div>

            <div>
              <label htmlFor="phone" className="text-body-sm font-medium text-on-surface">
                Phone <span className="text-destructive">*</span>
              </label>
              <input
                id="phone"
                type="tel"
                value={state.phone}
                onChange={(e) => patch({ phone: e.target.value })}
                className="mt-2 flex w-full rounded-xl border border-input bg-background px-4 py-3 text-body-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
                autoComplete="tel"
              />
            </div>

            <div>
              <label htmlFor="email" className="text-body-sm font-medium text-on-surface">
                Email <span className="text-on-surface-variant">(optional)</span>
              </label>
              <input
                id="email"
                type="email"
                value={state.email}
                onChange={(e) => patch({ email: e.target.value })}
                className="mt-2 flex w-full rounded-xl border border-input bg-background px-4 py-3 text-body-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
                autoComplete="email"
              />
            </div>
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
              disabled={
                !state.reason ||
                !state.fname.trim() ||
                !state.lname.trim() ||
                !state.phone.trim()
              }
              className="px-8"
              onClick={() => goStep(4)}
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
              value={`${selectedDoctor.name} · ${selectedDoctor.spec}`}
            />
            <ReviewRow
              icon={<Calendar className="h-4 w-4" />}
              label="Date & time"
              value={
                state.date && state.time
                  ? `${format(parseYmd(state.date), "EEEE, MMMM d, yyyy")} at ${formatTime12h(state.time)}`
                  : ""
              }
            />
            <ReviewRow
              icon={<ClipboardList className="h-4 w-4" />}
              label="Reason"
              value={state.reason}
            />
            <ReviewRow
              icon={<User className="h-4 w-4" />}
              label="Patient"
              value={`${state.fname} ${state.lname} · ${state.phone}`}
            />
          </div>

          {state.notes && (
            <p className="mt-4 text-body-sm text-on-surface-variant">
              <span className="font-medium text-on-surface">Notes:</span> {state.notes}
            </p>
          )}

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

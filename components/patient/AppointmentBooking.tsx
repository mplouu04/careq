"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  addDays,
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
import { getClinicTodayYmd } from "@/lib/datetime";
import { CareqButton } from "@/components/careq/careq-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StepIndicator } from "@/components/careq/step-indicator";
import { TimeSlotPicker } from "@/components/patient/TimeSlotPicker";

type Doctor = { id: string; first_name: string; last_name: string };
type ApptType = { id: string; name: string; duration: number };

type BookingState = {
  step: number;
  doctorId: string;
  appTypeId: string;
  date: string;
  time: string;
  reason: string;
  fname: string;
  lname: string;
  phone: string;
  email: string;
  dob: string;
  gender: string;
  address: string;
  consent: boolean;
  termsAgreed: boolean;
  reference: string;
};

const INITIAL_STATE: BookingState = {
  step: 1,
  doctorId: "",
  appTypeId: "",
  date: "",
  time: "",
  reason: "",
  fname: "",
  lname: "",
  phone: "",
  email: "",
  dob: "",
  gender: "",
  address: "",
  consent: false,
  termsAgreed: false,
  reference: "",
};

const STEPS = [
  { id: "1", label: "Doctor" },
  { id: "2", label: "Date & time" },
  { id: "3", label: "Details" },
  { id: "4", label: "Review" },
];

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

function doctorName(d: Doctor): string {
  return `Dr. ${d.first_name} ${d.last_name}`;
}

function doctorInitials(d: Doctor): string {
  return `${d.first_name.charAt(0)}${d.last_name.charAt(0)}`.toUpperCase();
}

export function AppointmentBooking() {
  const params = useSearchParams();
  const publicId = params.get("publicId");

  const [state, setState] = useState<BookingState>(INITIAL_STATE);
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  const [confirming, setConfirming] = useState(false);

  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [types, setTypes] = useState<ApptType[]>([]);
  const [slots, setSlots] = useState<string[]>([]);
  const [doctorsLoading, setDoctorsLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);

  const todayYmd = getClinicTodayYmd();
  const todayDate = parseYmd(todayYmd);
  const maxDate = useMemo(
    () => format(addDays(parseYmd(todayYmd), 30), "yyyy-MM-dd"),
    [todayYmd]
  );
  const maxDateObj = parseYmd(maxDate);

  const selectedDoctor = doctors.find((d) => d.id === state.doctorId);
  const selectedType = types.find((t) => String(t.id) === state.appTypeId);

  const bookingStateRef = useRef({
    doctorId: state.doctorId,
    date: state.date,
    appTypeId: state.appTypeId,
  });
  useEffect(() => {
    bookingStateRef.current = {
      doctorId: state.doctorId,
      date: state.date,
      appTypeId: state.appTypeId,
    };
  }, [state.doctorId, state.date, state.appTypeId]);

  const fetchCatalogs = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setDoctorsLoading(true);
    try {
      const [doctorsRes, typesRes] = await Promise.all([
        fetch("/api/doctors", { cache: "no-store" }),
        fetch("/api/appointment-types", { cache: "no-store" }),
      ]);
      if (!doctorsRes.ok || !typesRes.ok) throw new Error("catalog");
      const [doctorsData, typesData] = await Promise.all([
        doctorsRes.json(),
        typesRes.json(),
      ]);
      const nextDoctors: Doctor[] = doctorsData.doctors ?? [];
      setDoctors(nextDoctors);
      setTypes(typesData.types ?? []);

      const selectedId = bookingStateRef.current.doctorId;
      if (selectedId && !nextDoctors.some((d) => d.id === selectedId)) {
        setState((s) => ({
          ...s,
          doctorId: "",
          date: "",
          time: "",
          step: s.step > 1 ? 1 : s.step,
        }));
        toast.message("The selected doctor is no longer available. Please choose another.");
      }
    } catch {
      if (!opts?.silent) {
        toast.error("Unable to load booking options. Please refresh the page.");
      }
    } finally {
      if (!opts?.silent) setDoctorsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchCatalogs();
  }, [fetchCatalogs]);

  const refetchSlots = useCallback(
    async (doctorId: string, date: string, appTypeId: string) => {
      if (!doctorId || !date || !appTypeId) {
        setSlots([]);
        return;
      }
      const type = types.find((t) => String(t.id) === appTypeId);
      const duration = type?.duration ?? 30;
      const qs = new URLSearchParams({
        doctorId,
        date,
        durationMinutes: String(duration),
        appointmentTypeId: appTypeId,
      });
      setSlotsLoading(true);
      try {
        const r = await fetch(`/api/doctors/availability?${qs}`);
        if (!r.ok) {
          setSlots([]);
          toast.error("Unable to load available time slots.");
          return;
        }
        const d = await r.json();
        const available: string[] = d.available_slots ?? d.slots ?? [];
        setSlots(available);
        if (d.no_schedule && available.length === 0) {
          toast.error(
            "No availability — doctor schedule may not be configured for this day."
          );
        }
      } catch {
        setSlots([]);
        toast.error("Unable to load available time slots.");
      } finally {
        setSlotsLoading(false);
      }
    },
    [types]
  );

  useEffect(() => {
    refetchSlots(state.doctorId, state.date, state.appTypeId);
  }, [state.doctorId, state.date, state.appTypeId, refetchSlots]);

  // Keep a stable ref to refetchSlots so the channel effect below
  // does not re-subscribe every time the callback identity changes.
  const refetchSlotsRef = useRef(refetchSlots);
  useEffect(() => {
    refetchSlotsRef.current = refetchSlots;
  }, [refetchSlots]);

  useEffect(() => {
    const onTabFocus = () => {
      if (document.visibilityState !== "visible") return;
      void fetchCatalogs({ silent: true });
      const { doctorId, date, appTypeId } = bookingStateRef.current;
      if (doctorId && date && appTypeId) {
        void refetchSlotsRef.current(doctorId, date, appTypeId);
      }
    };
    const onVisibilityChange = () => onTabFocus();
    const onWindowFocus = () => onTabFocus();
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) onTabFocus();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("focus", onWindowFocus);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("focus", onWindowFocus);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [fetchCatalogs]);

  // Live doctor catalog when admin creates/deactivates staff
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("booking-doctors-catalog")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff" },
        () => {
          void fetchCatalogs({ silent: true });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [fetchCatalogs]);

  // Re-fetch slots live when another patient books, or staff changes
  // schedule hours / blocks for the selected doctor.
  useEffect(() => {
    if (!state.doctorId || !state.date) return;

    const refetch = () => {
      refetchSlotsRef.current(state.doctorId, state.date, state.appTypeId);
    };

    const supabase = createClient();
    const channel = supabase
      .channel(`booking-slots-${state.doctorId}-${state.date}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "checkins" }, refetch)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "doctor_schedules",
          filter: `doctor_id=eq.${state.doctorId}`,
        },
        refetch
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "doctor_blocks",
          filter: `doctor_id=eq.${state.doctorId}`,
        },
        refetch
      )
      .subscribe();

    // Safety-net heartbeat for silently dropped WAL events
    const heartbeat = setInterval(refetch, 15000);

    return () => {
      clearInterval(heartbeat);
      void supabase.removeChannel(channel);
    };
  }, [state.doctorId, state.date, state.appTypeId]);

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
    setState({ ...INITIAL_STATE, step: 1 });
    setViewMonth(startOfMonth(new Date()));
    setSlots([]);
  };

  const guestDetailsValid =
    state.fname.trim() &&
    state.lname.trim() &&
    state.phone.trim().replace(/\D/g, "").length === 11 &&
    state.dob &&
    state.gender &&
    state.address.trim() &&
    state.consent;

  const step3Valid = publicId
    ? state.termsAgreed
    : guestDetailsValid && state.termsAgreed;

  const handleConfirm = async () => {
    if (!state.termsAgreed) {
      toast.error("Agree to clinic terms to continue.");
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
        payload.firstName = state.fname.trim();
        payload.lastName = state.lname.trim();
        payload.phone = state.phone.replace(/\D/g, "");
        payload.dob = state.dob;
        payload.gender = state.gender;
        payload.address = state.address.trim();
        payload.consent = state.consent;
        if (state.email.trim()) payload.email = state.email.trim();
      }

      const res = await fetch("/api/appointments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) {
        if (data.code === "slot_unavailable") {
          toast.error(data.error ?? "That slot was just taken. Please choose another time.");
          await refetchSlots(state.doctorId, state.date, state.appTypeId);
          patch({ step: 2, time: "" });
        } else {
          toast.error(data.error ?? "Booking failed");
        }
        return;
      }

      patch({ reference: data.appointmentID, step: 5 });
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
        steps={STEPS}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : doctors.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">
              No doctors available for booking right now.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {doctors.map((doctor, idx) => {
                const selected = state.doctorId === doctor.id;
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
            Weekdays only · Up to 30 days in advance
          </p>

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
              <label htmlFor="reason" className="text-body-sm font-medium text-on-surface">
                Reason for visit{" "}
                <span className="text-on-surface-variant">(optional)</span>
              </label>
              <textarea
                id="reason"
                rows={3}
                value={state.reason}
                onChange={(e) => patch({ reason: e.target.value })}
                placeholder="Brief reason for the visit"
                className="mt-2 flex w-full rounded-xl border border-input bg-background px-4 py-3 text-body-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[88px]"
              />
            </div>

            {!publicId && (
              <>
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

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="dob" className="text-body-sm font-medium text-on-surface">
                      Date of birth <span className="text-destructive">*</span>
                    </label>
                    <input
                      id="dob"
                      type="date"
                      value={state.dob}
                      onChange={(e) => patch({ dob: e.target.value })}
                      max={todayYmd}
                      className="mt-2 flex w-full rounded-xl border border-input bg-background px-4 py-3 text-body-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label htmlFor="gender" className="text-body-sm font-medium text-on-surface">
                      Gender <span className="text-destructive">*</span>
                    </label>
                    <select
                      id="gender"
                      value={state.gender}
                      onChange={(e) => patch({ gender: e.target.value })}
                      className="mt-2 flex w-full rounded-xl border border-input bg-background px-4 py-3 text-body-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="address" className="text-body-sm font-medium text-on-surface">
                    Address <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="address"
                    type="text"
                    value={state.address}
                    onChange={(e) => patch({ address: e.target.value })}
                    className="mt-2 flex w-full rounded-xl border border-input bg-background px-4 py-3 text-body-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
                    autoComplete="street-address"
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="text-body-sm font-medium text-on-surface">
                    Phone <span className="text-destructive">*</span>
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    inputMode="tel"
                    placeholder="09XXXXXXXXX"
                    maxLength={11}
                    value={state.phone}
                    onChange={(e) =>
                      patch({ phone: e.target.value.replace(/\D/g, "").slice(0, 11) })
                    }
                    className="mt-2 flex w-full rounded-xl border border-input bg-background px-4 py-3 text-body-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[44px]"
                    autoComplete="tel"
                  />
                  <p className="text-label-sm text-on-surface-variant mt-1">
                    11-digit mobile number
                  </p>
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

                <label className="flex items-start gap-2 text-body-sm cursor-pointer min-h-[44px]">
                  <input
                    type="checkbox"
                    checked={state.consent}
                    onChange={(e) => patch({ consent: e.target.checked })}
                    className="mt-1 rounded"
                  />
                  <span>
                    I consent to the storage and processing of my personal data.{" "}
                    <span className="text-destructive">*</span>
                  </span>
                </label>
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
              disabled={!step3Valid}
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

"use client";

import { appointmentApi, appointmentsDataApi } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Calendar, ClipboardList } from "lucide-react";
import {
  CareqCard,
  CareqButton,
  ConfirmDialog,
  EmptyState,
  AppointmentListSkeleton,
  FormLabel,
  FormInput,
  StatusBadge,
  type QueueStatusVariant,
} from "@/components/careq";
import { Button } from "@/components/ui/button";
import { cn, isValidRef } from "@/lib/utils";
import { useRovingTabs } from "@/lib/hooks/useRovingTabs";

type LookupMethod = "phone" | "reference";

type Appointment = {
  checkinId: string;
  reference: string;
  date: string;
  time: string;
  doctor: string;
  type: string;
  reason: string;
  status: string;
};

type LookupResult = {
  appointments: Appointment[];
  patientName: string;
};

type ActiveLookup =
  | { method: "phone"; phone: string; dob: string }
  | { method: "reference"; reference: string; phone: string };

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  checked_in: "Confirmed",
  cancelled: "Cancelled",
  no_show: "No Show",
  in_progress: "In Progress",
  completed: "Completed",
};

const STATUS_VARIANT: Record<string, QueueStatusVariant> = {
  pending: "waiting",
  checked_in: "confirmed",
  cancelled: "cancelled",
  no_show: "no_show",
  in_progress: "called",
  completed: "completed",
};

const LOOKUP_TABS: { value: LookupMethod; label: string }[] = [
  { value: "phone", label: "By Phone & DOB" },
  { value: "reference", label: "By Reference" },
];

function formatDobInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDobInput(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

const TERMINAL_STATUSES = ["cancelled", "completed", "no_show"];

function lookupQueryKey(lookup: ActiveLookup) {
  if (lookup.method === "phone") {
    return queryKeys.appointments.byPhone(lookup.phone, lookup.dob);
  }
  return queryKeys.appointments.byReference(lookup.reference, lookup.phone);
}

export function MyAppointments() {
  const queryClient = useQueryClient();
  const [lookupMethod, setLookupMethod] = useState<LookupMethod>("phone");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [reference, setReference] = useState("");
  const [activeLookup, setActiveLookup] = useState<ActiveLookup | null>(null);
  const [cancelRef, setCancelRef] = useState<string | null>(null);
  const [cancelPhone, setCancelPhone] = useState("");

  const queryKey = useMemo(
    () => (activeLookup ? lookupQueryKey(activeLookup) : ["appointments", "idle"]),
    [activeLookup]
  );

  const lookupQuery = useQuery({
    queryKey,
    queryFn: async (): Promise<LookupResult> => {
      if (!activeLookup) return { appointments: [], patientName: "" };
      if (activeLookup.method === "phone") {
        const data = await appointmentsDataApi.byPhone(
          activeLookup.phone,
          activeLookup.dob
        );
        return {
          appointments: (data.appointments ?? []) as Appointment[],
          patientName: data.patientName ?? "",
        };
      }
      const data = await appointmentsDataApi.byReference(
        activeLookup.reference,
        activeLookup.phone
      );
      const appointments = (data.appointments ?? []) as Appointment[];
      if (appointments.length === 0) {
        toast.error(
          "No appointment found. Check your reference number and registered phone (must match the number on file)."
        );
      }
      return {
        appointments,
        patientName: data.patientName ?? "",
      };
    },
    enabled: Boolean(activeLookup),
    staleTime: 10_000,
    retry: 1,
  });

  const appointments = lookupQuery.data?.appointments ?? [];
  const patientName = lookupQuery.data?.patientName ?? "";
  const searched = Boolean(activeLookup) && (lookupQuery.isSuccess || lookupQuery.isError);
  const loading = lookupQuery.isFetching;

  useEffect(() => {
    if (lookupQuery.isError) {
      toast.error(
        lookupQuery.error instanceof Error
          ? lookupQuery.error.message
          : "Unable to load appointments. Please check your connection."
      );
    }
  }, [lookupQuery.isError, lookupQuery.error]);

  const checkinIds = useMemo(
    () => new Set(appointments.map((a) => String(a.checkinId))),
    [appointments]
  );
  const checkinIdsRef = useRef(checkinIds);
  useEffect(() => {
    checkinIdsRef.current = checkinIds;
  }, [checkinIds]);

  useEffect(() => {
    if (checkinIds.size === 0 || !activeLookup) return;

    const supabase = createClient();
    const channel = supabase
      .channel("myappointments-live")
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "checkins" },
        (payload) => {
          const changedId = String(
            (payload.new as { checkin_id?: string | number })?.checkin_id ?? ""
          );
          if (checkinIdsRef.current.has(changedId)) {
            void queryClient.invalidateQueries({ queryKey });
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [checkinIds, activeLookup, queryClient, queryKey]);

  const handleLookupMethodChange = useCallback((method: LookupMethod) => {
    setLookupMethod(method);
    setActiveLookup(null);
  }, []);

  const { getTabProps } = useRovingTabs({
    values: ["phone", "reference"] as const,
    value: lookupMethod,
    onChange: handleLookupMethodChange,
  });

  function lookup() {
    if (lookupMethod === "phone") {
      const isoDob = parseDobInput(dob);
      if (!phone || !isoDob) {
        toast.error("Please enter both phone number and date of birth.");
        return;
      }
      setActiveLookup({ method: "phone", phone: phone.trim(), dob: isoDob });
      return;
    }

    const ref = reference.trim();
    const phoneForLookup = phone.trim();
    if (!ref) {
      toast.error("Please enter your reference number.");
      return;
    }
    if (!phoneForLookup) {
      toast.error("Please enter your registered phone number.");
      return;
    }
    const normalizedRef = ref.toUpperCase().replace(/[\s-]/g, "");
    if (!isValidRef(normalizedRef)) {
      toast.error("Invalid reference format.");
      return;
    }
    setActiveLookup({
      method: "reference",
      reference: normalizedRef,
      phone: phoneForLookup,
    });
  }

  function openCancelDialog(ref: string) {
    setCancelRef(ref);
    setCancelPhone("");
  }

  const cancelMutation = useMutation({
    mutationFn: ({ ref, phoneForCancel }: { ref: string; phoneForCancel: string }) =>
      appointmentApi.cancel(ref, phoneForCancel),
    onMutate: async ({ ref }) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<LookupResult>(queryKey);
      if (previous) {
        queryClient.setQueryData<LookupResult>(queryKey, {
          ...previous,
          appointments: previous.appointments.map((a) =>
            a.reference === ref ? { ...a, status: "cancelled" } : a
          ),
        });
      }
      return { previous };
    },
    onError: (err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
      toast.error(err instanceof Error ? err.message : "Cancel failed");
    },
    onSuccess: () => {
      toast.success("Appointment cancelled.");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey });
    },
  });

  function confirmCancel(ref: string) {
    const phoneForCancel =
      lookupMethod === "phone" ? phone.trim() : cancelPhone.trim();
    if (!phoneForCancel) {
      toast.error("Please enter your registered phone number to confirm cancellation.");
      return;
    }
    setCancelRef(null);
    cancelMutation.mutate({ ref, phoneForCancel });
  }

  return (
    <div className="space-y-5 max-w-xl">
      <CareqCard className="overflow-hidden">
        <div className="min-w-0 px-6 py-5 space-y-5">
          <div>
            <h3 className="text-headline-sm text-on-surface">Look Up Appointments</h3>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              {lookupMethod === "phone"
                ? "Enter your phone and date of birth"
                : "Enter your appointment reference and registered phone"}
            </p>
          </div>

          <div
            className="flex w-full rounded-xl bg-surface-container p-1"
            role="tablist"
            aria-label="Lookup method"
          >
            {LOOKUP_TABS.map((tab) => {
              const isActive = lookupMethod === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  {...getTabProps(tab.value)}
                  aria-controls={`panel-${tab.value}`}
                  onClick={() => handleLookupMethodChange(tab.value)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2.5 text-body-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    isActive
                      ? "bg-surface-container-lowest text-on-surface font-semibold shadow-sm"
                      : "text-on-surface-variant hover:text-on-surface"
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {lookupMethod === "phone" ? (
            <div
              className="flex flex-col gap-4 sm:flex-row sm:items-start"
              role="tabpanel"
              id="panel-phone"
              aria-labelledby="tab-phone"
            >
              <div className="min-w-0 flex-1">
                <FormLabel htmlFor="lookup-phone">Phone Number</FormLabel>
                <FormInput
                  id="lookup-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09XX XXX XXXX"
                />
              </div>
              <div className="min-w-0 flex-1">
                <FormLabel htmlFor="lookup-dob">Date of Birth</FormLabel>
                <div className="relative">
                  <FormInput
                    id="lookup-dob"
                    type="text"
                    inputMode="numeric"
                    value={dob}
                    onChange={(e) => setDob(formatDobInput(e.target.value))}
                    placeholder="dd/mm/yyyy"
                    maxLength={10}
                    className="pr-10"
                  />
                  <Calendar
                    className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                    aria-hidden
                  />
                </div>
              </div>
            </div>
          ) : (
            <div
              className="flex flex-col gap-4"
              role="tabpanel"
              id="panel-reference"
              aria-labelledby="tab-reference"
            >
              <div className="min-w-0 w-full">
                <FormLabel htmlFor="lookup-reference">Reference Number</FormLabel>
                <FormInput
                  id="lookup-reference"
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="APT..."
                  className="font-mono tracking-wide"
                  autoCapitalize="characters"
                />
              </div>
              <div className="min-w-0 w-full">
                <FormLabel htmlFor="lookup-ref-phone">Registered Phone</FormLabel>
                <FormInput
                  id="lookup-ref-phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="09XX XXX XXXX"
                  autoComplete="tel"
                />
              </div>
            </div>
          )}

          <CareqButton onClick={lookup} disabled={loading} className="w-full">
            <ClipboardList className="h-4 w-4" />
            {loading ? "Looking up..." : "Look Up Appointments"}
          </CareqButton>
        </div>
      </CareqCard>

      {activeLookup && loading && !lookupQuery.data ? (
        <AppointmentListSkeleton />
      ) : null}

      {searched && !loading && (
        <>
          {patientName && (
            <p className="text-headline-sm text-foreground">
              Hello, <strong>{patientName}</strong>!
            </p>
          )}
          {appointments.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No upcoming appointments"
              description="We could not find any appointments for the details provided."
            />
          ) : (
            <div className="space-y-3">
              {appointments.map((a) => (
                <CareqCard
                  key={a.checkinId}
                  className="p-4 md:p-5 space-y-3 border-outline-variant animate-in fade-in duration-200"
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-headline-sm text-primary truncate">
                        {a.reference}
                      </p>
                      <p className="text-body-sm text-on-surface-variant">
                        {a.doctor} — {a.type}
                      </p>
                      <p className="text-body-sm text-foreground">
                        {a.date} at {a.time}
                      </p>
                      {a.reason && (
                        <p className="text-body-sm text-on-surface-variant">Reason: {a.reason}</p>
                      )}
                    </div>
                    <StatusBadge
                      status={STATUS_VARIANT[a.status] ?? "pending"}
                      label={STATUS_LABELS[a.status] ?? a.status}
                    />
                  </div>
                  {!TERMINAL_STATUSES.includes(a.status) && (
                    <Button
                      type="button"
                      variant="outline"
                      className="text-destructive border-destructive/30 hover:bg-destructive/10"
                      onClick={() => openCancelDialog(a.reference)}
                      disabled={cancelMutation.isPending}
                    >
                      Cancel Appointment
                    </Button>
                  )}
                </CareqCard>
              ))}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!cancelRef}
        onOpenChange={(open) => {
          if (!open) {
            setCancelRef(null);
            setCancelPhone("");
          }
        }}
        title="Cancel Appointment"
        description={
          cancelRef
            ? `Are you sure you want to cancel appointment ${cancelRef}? This cannot be undone.`
            : undefined
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setCancelRef(null);
                setCancelPhone("");
              }}
            >
              Go Back
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelRef && confirmCancel(cancelRef)}
            >
              Yes, Cancel
            </Button>
          </>
        }
      >
        {lookupMethod === "reference" && cancelRef && (
          <div className="min-w-0">
            <FormLabel htmlFor="cancel-phone">Registered Phone Number</FormLabel>
            <FormInput
              id="cancel-phone"
              type="tel"
              inputMode="tel"
              value={cancelPhone}
              onChange={(e) => setCancelPhone(e.target.value)}
              placeholder="09XX XXX XXXX"
              autoComplete="tel"
            />
            <p className="text-body-sm text-on-surface-variant mt-1.5">
              Enter the phone number on file to verify this cancellation.
            </p>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

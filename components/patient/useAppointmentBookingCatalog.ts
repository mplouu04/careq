"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { catalogApi } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { getClinicTodayYmd } from "@/lib/datetime";
import { maxDobForMinAge } from "@/lib/schemas/patient";
import {
  DOCTORS_BROADCAST_EVENT,
  DOCTORS_BROADCAST_TOPIC,
} from "@/lib/supabase/broadcast-shared";
import { logRealtimeStatus } from "@/lib/observability-client";
import {
  addDays,
  format,
  startOfMonth,
} from "date-fns";

export type BookingDoctor = {
  id: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
};

export type BookingApptType = { id: string; name: string; duration: number };

export type BookingState = {
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

export const BOOKING_INITIAL_STATE: BookingState = {
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

export const BOOKING_STEPS = [
  { id: "1", label: "Doctor" },
  { id: "2", label: "Date & time" },
  { id: "3", label: "Details" },
  { id: "4", label: "Review" },
];

export function useAppointmentBookingCatalog(state: BookingState) {
  const queryClient = useQueryClient();
  const catalogErrorToasted = useRef(false);

  const todayYmd = getClinicTodayYmd();
  const maxDobYmd = useMemo(() => maxDobForMinAge(todayYmd), [todayYmd]);
  const maxDate = useMemo(
    () => format(addDays(new Date(`${todayYmd}T12:00:00`), 30), "yyyy-MM-dd"),
    [todayYmd]
  );

  const doctorsQuery = useQuery({
    queryKey: queryKeys.doctors.list(),
    queryFn: async () => {
      const data = await catalogApi.doctors();
      return (data.doctors ?? []).map((d) => ({
        ...d,
        is_active: d.is_active === true,
      })) as BookingDoctor[];
    },
    // Fallback path: if the Broadcast/postgres_changes signals never arrive
    // (silent WS drop, RLS filter, missed migration) the booking page still
    // catches up within one poll interval. See plan H3.
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const typesQuery = useQuery({
    queryKey: queryKeys.appointmentTypes.list(),
    queryFn: async () => {
      const data = await catalogApi.appointmentTypes();
      return (data.types ?? []) as BookingApptType[];
    },
    staleTime: 60_000,
  });

  const doctors = doctorsQuery.data ?? [];
  const types = typesQuery.data ?? [];
  const doctorsLoading = doctorsQuery.isPending || typesQuery.isPending;
  const selectedType = types.find((t) => String(t.id) === state.appTypeId);
  const duration = selectedType?.duration ?? 30;
  const slotsEnabled = Boolean(state.doctorId && state.date && state.appTypeId);

  const slotsQuery = useQuery({
    queryKey: queryKeys.doctors.availability(
      state.doctorId,
      state.date,
      state.appTypeId,
      duration
    ),
    queryFn: async () => {
      const d = await catalogApi.availability({
        doctorId: state.doctorId,
        date: state.date,
        durationMinutes: duration,
        appointmentTypeId: state.appTypeId,
      });
      const available: string[] = d.available_slots ?? d.slots ?? [];
      if (d.no_schedule && available.length === 0) {
        toast.error(
          "No availability — doctor schedule may not be configured for this day."
        );
      }
      return available;
    },
    enabled: slotsEnabled,
    staleTime: 5_000,
  });

  useEffect(() => {
    if ((doctorsQuery.isError || typesQuery.isError) && !catalogErrorToasted.current) {
      catalogErrorToasted.current = true;
      toast.error("Unable to load booking options. Please refresh the page.");
    }
  }, [doctorsQuery.isError, typesQuery.isError]);

  useEffect(() => {
    if (slotsQuery.isError) {
      toast.error("Unable to load available time slots.");
    }
  }, [slotsQuery.isError]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      void queryClient.invalidateQueries({ queryKey: queryKeys.doctors.list() });
      if (slotsEnabled) {
        void queryClient.invalidateQueries({
          queryKey: queryKeys.doctors.availability(
            state.doctorId,
            state.date,
            state.appTypeId,
            duration
          ),
        });
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [
    queryClient,
    slotsEnabled,
    state.doctorId,
    state.date,
    state.appTypeId,
    duration,
  ]);

  useEffect(() => {
    const supabase = createClient();
    const invalidateDoctors = () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.doctors.list() });

    // Primary path: server-emitted Broadcast on toggle. Broadcast is not
    // RLS-filtered so it delivers both activate and deactivate transitions to
    // anon subscribers. See plan H1.
    const broadcastChannel = supabase
      .channel(DOCTORS_BROADCAST_TOPIC)
      .on(
        "broadcast",
        { event: DOCTORS_BROADCAST_EVENT },
        () => {
          void invalidateDoctors();
        }
      )
      .subscribe((status) => {
        logRealtimeStatus(DOCTORS_BROADCAST_TOPIC, status);
        // On a fresh (re)subscribe, force a one-shot refetch so a socket that
        // dropped and came back cannot leave us with a stale cached list.
        if (status === "SUBSCRIBED") {
          void invalidateDoctors();
        }
      });

    // Secondary path: postgres_changes on staff. Kept as a belt-and-suspenders
    // signal for authenticated staff users whose RLS allows them to observe
    // the transition anyway.
    const postgresChannel = supabase
      .channel("booking-doctors-catalog")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff" }, () => {
        void invalidateDoctors();
      })
      .subscribe((status) => {
        logRealtimeStatus("booking-doctors-catalog", status);
      });

    return () => {
      void supabase.removeChannel(broadcastChannel);
      void supabase.removeChannel(postgresChannel);
    };
  }, [queryClient]);

  useEffect(() => {
    if (state.step !== 2 || !state.doctorId || !state.date) return;

    const invalidateSlots = () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.doctors.availability(
          state.doctorId,
          state.date,
          state.appTypeId,
          duration
        ),
      });
    };

    const supabase = createClient();
    const channel = supabase
      .channel(`booking-slots-${state.doctorId}-${state.date}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "checkins" }, invalidateSlots)
      .on("postgres_changes", { event: "*", schema: "public", table: "doctor_schedules" }, invalidateSlots)
      .on("postgres_changes", { event: "*", schema: "public", table: "doctor_blocks" }, invalidateSlots)
      .subscribe();

    const heartbeat = setInterval(invalidateSlots, 30_000);

    return () => {
      clearInterval(heartbeat);
      void supabase.removeChannel(channel);
    };
  }, [state.step, state.doctorId, state.date, state.appTypeId, duration, queryClient]);

  return {
    queryClient,
    todayYmd,
    maxDobYmd,
    maxDate,
    doctors,
    types,
    doctorsLoading,
    selectedDoctor: doctors.find((d) => d.id === state.doctorId),
    selectedType,
    duration,
    slots: slotsQuery.data ?? [],
    slotsLoading: slotsEnabled && slotsQuery.isPending,
    slotsEnabled,
  };
}

export function useBookingViewMonth() {
  const [viewMonth, setViewMonth] = useState(() => startOfMonth(new Date()));
  return { viewMonth, setViewMonth };
}

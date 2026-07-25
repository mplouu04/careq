"use client";

import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Users, CircleDot } from "lucide-react";
import { StatCard, StatsRowSkeleton } from "@/components/careq";
import { clinicHoursLabel, isClinicOpenNow } from "@/lib/clinic-hours";
import { createClient } from "@/lib/supabase/client";
import { useRealtimePoll } from "@/lib/hooks/useRealtimePoll";
import { queueDataApi } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";

export function ClinicStatusBar({ className }: { className?: string }) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(() => isClinicOpenNow());

  const { data, isPending, isError } = useQuery({
    queryKey: queryKeys.queue.public(),
    queryFn: async () => {
      setOpen(isClinicOpenNow());
      return queueDataApi.public();
    },
    staleTime: 5_000,
  });

  const subscribeQueue = useMemo(
    () => (onChange: () => void) => {
      const supabase = createClient();
      return supabase
        .channel("clinic-status-bar")
        .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, onChange);
    },
    []
  );

  useRealtimePoll({
    fetchFn: async () => {
      setOpen(isClinicOpenNow());
      await queryClient.invalidateQueries({ queryKey: queryKeys.queue.public() });
    },
    subscribe: subscribeQueue,
    fallbackIntervalMs: 15000,
  });

  if (isPending) {
    return <StatsRowSkeleton className={className} />;
  }

  if (isError) {
    return (
      <div
        className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className ?? ""}`}
        aria-live="polite"
      >
        <StatCard
          label="Est. wait"
          value="Unavailable"
          subtext="Queue status could not be loaded"
          icon={Clock}
        />
        <StatCard
          label="In queue"
          value="—"
          subtext="Try again in a moment"
          icon={Users}
        />
        <StatCard
          label="Clinic"
          value={open ? "Open" : "Closed"}
          subtext={clinicHoursLabel()}
          icon={CircleDot}
        />
      </div>
    );
  }

  const waiting = data?.waiting?.length ?? 0;
  const avg = data?.avg_service_time ?? 10;
  const estWait =
    waiting > 0 ? `~${Math.min(avg * waiting, 120)} min` : open ? `~${avg} min` : "Closed";

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className ?? ""}`}
      aria-live="polite"
      aria-busy={isPending}
    >
      <StatCard
        label="Est. wait"
        value={estWait}
        subtext={
          !open
            ? "Clinic is currently closed"
            : waiting > 0
              ? `${waiting} patient${waiting === 1 ? "" : "s"} ahead · walk-in`
              : "No wait right now · walk-in"
        }
        icon={Clock}
      />
      <StatCard
        label="In queue"
        value={open ? String(waiting) : "—"}
        subtext={open ? "Waiting for service today" : "Check in during operating hours"}
        icon={Users}
      />
      <StatCard
        label="Clinic"
        value={open ? "Open" : "Closed"}
        subtext={clinicHoursLabel()}
        icon={CircleDot}
      />
    </div>
  );
}

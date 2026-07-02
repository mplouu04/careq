"use client";

import { useCallback, useMemo, useState } from "react";
import { Clock, Users, CircleDot } from "lucide-react";
import { StatCard } from "@/components/careq";
import { Skeleton } from "@/components/ui/skeleton";
import { clinicHoursLabel, isClinicOpenNow } from "@/lib/clinic-hours";
import { createClient } from "@/lib/supabase/client";
import { useRealtimePoll } from "@/lib/hooks/useRealtimePoll";

type PublicStats = {
  waiting_count: number;
  avg_service_time: number;
};

export function ClinicStatusBar({ className }: { className?: string }) {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [unavailable, setUnavailable] = useState(false);
  const [open, setOpen] = useState(true);

  const load = useCallback(async () => {
    setOpen(isClinicOpenNow());
    try {
      const r = await fetch("/api/queue/public");
      if (!r.ok) throw new Error("Failed to load queue status");
      const d: { waiting?: unknown[]; avg_service_time?: number } = await r.json();
      setStats({
        waiting_count: d.waiting?.length ?? 0,
        avg_service_time: d.avg_service_time ?? 10,
      });
      setUnavailable(false);
    } catch {
      setUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, []);

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
    fetchFn: load,
    subscribe: subscribeQueue,
    fallbackIntervalMs: 15000,
  });

  if (loading) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className ?? ""}`}>
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  if (unavailable) {
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

  const waiting = stats?.waiting_count ?? 0;
  const avg = stats?.avg_service_time ?? 10;
  const estWait =
    waiting > 0 ? `~${Math.min(avg * waiting, 120)} min` : open ? `~${avg} min` : "Closed";

  return (
    <div
      className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className ?? ""}`}
      aria-live="polite"
      aria-busy={loading}
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

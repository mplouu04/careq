"use client";

import { useEffect, useState } from "react";
import { Clock, Users, CircleDot } from "lucide-react";
import { StatCard } from "@/components/careq";
import { Skeleton } from "@/components/ui/skeleton";

type PublicStats = {
  waiting_count: number;
  avg_service_time: number;
};

export function ClinicStatusBar({ className }: { className?: string }) {
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/queue/public")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { waiting?: unknown[]; avg_service_time?: number } | null) => {
        setStats({
          waiting_count: d?.waiting?.length ?? 0,
          avg_service_time: d?.avg_service_time ?? 10,
        });
      })
      .catch(() => setStats({ waiting_count: 0, avg_service_time: 10 }))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-3 gap-3 ${className ?? ""}`}>
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
        <Skeleton className="h-24 rounded-xl" />
      </div>
    );
  }

  const waiting = stats?.waiting_count ?? 0;
  const avg = stats?.avg_service_time ?? 10;
  const estWait =
    waiting > 0
      ? `~${Math.min(avg * waiting, 120)} min`
      : `~${avg} min`;

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
          waiting > 0
            ? `${waiting} patient${waiting === 1 ? "" : "s"} ahead · walk-in`
            : "No wait right now · walk-in"
        }
        icon={Clock}
      />
      <StatCard
        label="In queue"
        value={String(waiting)}
        subtext="Waiting for service today"
        icon={Users}
      />
      <StatCard
        label="Clinic"
        value="Open"
        subtext="Check in during operating hours"
        icon={CircleDot}
      />
    </div>
  );
}

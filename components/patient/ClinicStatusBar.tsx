"use client";

import { useEffect, useState } from "react";
import { Clock, Users, CircleDot } from "lucide-react";
import { StatCard } from "@/components/careq";

type PublicStats = {
  waiting_count?: number;
  avg_service_time?: number;
};

export function ClinicStatusBar() {
  const [stats, setStats] = useState<PublicStats | null>(null);

  useEffect(() => {
    fetch("/api/queue/public")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { waiting?: unknown[]; avg_service_time?: number } | null) => {
        setStats({
          waiting_count: d?.waiting?.length ?? 0,
          avg_service_time: d?.avg_service_time ?? 10,
        });
      })
      .catch(() => setStats({ waiting_count: 0, avg_service_time: 10 }));
  }, []);

  const waiting = stats?.waiting_count ?? "—";
  const avg = stats?.avg_service_time ?? "—";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
      <StatCard
        label="Est. wait (walk-in)"
        value={typeof avg === "number" ? `~${avg * Math.max(1, Number(waiting) || 1)} min` : "—"}
        icon={Clock}
      />
      <StatCard
        label="In queue now"
        value={String(waiting)}
        subtext="Patients waiting today"
        icon={Users}
      />
      <StatCard
        label="Clinic status"
        value="Open"
        subtext="Check in during operating hours"
        icon={CircleDot}
      />
    </div>
  );
}

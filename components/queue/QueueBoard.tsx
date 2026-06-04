"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { User, Home } from "lucide-react";
import { CAREQ_DEFAULT_THEME_COLOR } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";

type DisplayConfig = {
  display_name: string;
  location: string;
  theme_color: string;
  show_wait_time: boolean;
  show_priority: boolean;
};

type NowServingItem = {
  id: string | number;
  queueId?: number;
  queue_number?: string;
  name: string;
  doctor: string;
  room: string;
  status: string;
  priority?: string;
  called_at?: string | null;
};

type WaitingItem = {
  id: string | number;
  queueId?: number;
  queue_number?: string;
  name: string;
  reason: string;
  position: number;
  est_wait_minutes: number;
  priority?: string;
};

function ordinal(n: number) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function priorityLabel(priority: string | undefined) {
  if (!priority || priority === "normal") return null;
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

export function QueueBoard({ screenId }: { screenId?: string }) {
  const [nowServing, setNowServing] = useState<NowServingItem[]>([]);
  const [waiting, setWaiting] = useState<WaitingItem[]>([]);
  const [avgServiceTime, setAvgServiceTime] = useState(10);
  const [display, setDisplay] = useState<DisplayConfig>({
    display_name: "CAREQ",
    location: "",
    theme_color: CAREQ_DEFAULT_THEME_COLOR,
    show_wait_time: true,
    show_priority: true,
  });
  const [now, setNow] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const qs = screenId ? `?screenId=${encodeURIComponent(screenId)}` : "";
      const res = await fetch(`/api/queue/public${qs}`);
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json();
      setLoadError(false);
      if (data.display) setDisplay(data.display);
      setNowServing(data.nowServing ?? []);
      setWaiting((data.waiting ?? []).slice(0, 8));
      setAvgServiceTime(data.avg_service_time ?? 10);
    } catch {
      setLoadError(true);
    }
  }, [screenId]);

  useEffect(() => {
    setNow(new Date());
    load();

    const supabase = createClient();
    const channel = supabase
      .channel(`queue-board-${screenId ?? "default"}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () => load())
      .subscribe();

    const interval = setInterval(load, 3000);
    const clock = setInterval(() => setNow(new Date()), 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      clearInterval(clock);
    };
  }, [load, screenId]);

  const timeStr = now
    ? now.toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";

  const current = nowServing[0] ?? null;
  const themeColor = display.theme_color || CAREQ_DEFAULT_THEME_COLOR;

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden bg-surface">
      {loadError && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-destructive text-destructive-foreground text-center text-body-sm py-2">
          Unable to load queue data. Retrying...
        </div>
      )}

      <div
        className="w-full lg:w-2/3 h-1/2 lg:h-auto flex flex-col p-6 overflow-y-auto text-primary-foreground"
        style={{ backgroundColor: themeColor }}
      >
        <div className="text-center mb-6 flex items-center justify-between gap-4">
          <div className="text-left min-w-0">
            <h1 className="text-headline-sm font-bold truncate">{display.display_name}</h1>
            {display.location && (
              <p className="text-body-sm opacity-80 truncate">{display.location}</p>
            )}
          </div>
          <div className="text-center flex-1 shrink-0">
            <h2 className="text-headline-sm font-bold tracking-widest">NOW SERVING</h2>
          </div>
          <div className="text-right text-body-sm opacity-90 shrink-0">
            <div className="text-xl font-mono">{timeStr}</div>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center">
          <div className="current-patient-card text-center py-10 px-8 w-full">
            {current ? (
              <>
                <div className="queue-number-lg mb-3" style={{ color: themeColor }}>
                  {current.queue_number ?? current.id}
                </div>
                <h3 className="patient-name text-on-surface">{current.name || "—"}</h3>
                <div className="patient-info">
                  <div className="info-item text-on-surface-variant">
                    <User className="w-4 h-4" aria-hidden />
                    <span>{current.doctor || "—"}</span>
                  </div>
                  <div className="info-item text-on-surface-variant">
                    <Home className="w-4 h-4" aria-hidden />
                    <span>{current.room || "—"}</span>
                  </div>
                </div>
              </>
            ) : (
              <h3 className="patient-name text-on-surface-variant">No Patient Currently Serving</h3>
            )}
          </div>
        </div>
      </div>

      <div className="upcoming-queue-section w-full lg:w-1/3 h-1/2 lg:h-auto flex flex-col p-6 overflow-y-auto bg-surface-container-lowest">
        <h4 className="text-headline-sm font-bold text-center text-on-surface mb-6 tracking-wide">
          UPCOMING PATIENTS
        </h4>
        <ul className="upcoming-list">
          {waiting.length === 0 ? (
            <li className="upcoming-item">
              <div className="patient-details">
                <div className="text-on-surface-variant text-body-md">No upcoming patients</div>
              </div>
            </li>
          ) : (
            waiting.map((q, i) => {
              const pos = i + 1;
              const estWait = q.est_wait_minutes ?? pos * avgServiceTime;
              const pri = priorityLabel(q.priority);
              return (
                <li key={q.queueId ?? q.id} className="upcoming-item">
                  <div className="queue-number-sm" style={{ color: themeColor }}>
                    {q.queue_number ?? q.id}
                  </div>
                  <div className="patient-details">
                    <div className="font-medium text-on-surface">{q.name}</div>
                    <div className="appointment-time mt-1 flex flex-wrap gap-1 items-center">
                      <span className="position-badge">{ordinal(pos)} in line</span>
                      {display.show_wait_time && (
                        <span className="est-wait-badge">~{estWait} min</span>
                      )}
                      {display.show_priority && pri && (
                        <span
                          className={cn(
                            "text-label-sm font-semibold px-2 py-0.5 rounded-full uppercase",
                            q.priority === "emergency" && "bg-destructive text-white",
                            q.priority === "high" && "bg-amber-500 text-white",
                            q.priority === "low" && "bg-surface-container text-on-surface-variant"
                          )}
                        >
                          {pri}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

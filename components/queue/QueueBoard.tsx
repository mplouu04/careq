"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { CAREQ_DEFAULT_THEME_COLOR } from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { useRealtimePoll } from "@/lib/hooks/useRealtimePoll";
import { queueDataApi } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";
import { QueueBoardSkeleton } from "@/components/careq";

type DisplayConfig = {
  display_name: string;
  location: string;
  theme_color: string;
  show_wait_time: boolean;
  show_priority: boolean;
};

type RoomPanel = {
  id: number;
  name: string;
  description?: string;
  current: {
    queue_number: string;
  } | null;
};

type WaitingItem = {
  id: string | number;
  queueId?: number;
  queue_number?: string;
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

type RealtimeStatus = "connecting" | "connected" | "error";

const DEFAULT_DISPLAY: DisplayConfig = {
  display_name: "CAREQ",
  location: "",
  theme_color: CAREQ_DEFAULT_THEME_COLOR,
  show_wait_time: true,
  show_priority: true,
};

export function QueueBoard({ screenId }: { screenId?: string }) {
  const searchParams = useSearchParams();
  const tvMode = searchParams.get("theme") === "tv";
  const queryClient = useQueryClient();
  const [now, setNow] = useState<Date | null>(null);

  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: queryKeys.queue.public(screenId),
    queryFn: () => queueDataApi.public(screenId),
    staleTime: 3_000,
  });

  const subscribeQueue = useMemo(
    () => (onChange: () => void) => {
      const supabase = createClient();
      return supabase
        .channel(`queue-board-${screenId ?? "default"}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, onChange);
    },
    [screenId]
  );

  const { isLive } = useRealtimePoll({
    fetchFn: async () => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.queue.public(screenId),
      });
    },
    subscribe: subscribeQueue,
    fallbackIntervalMs: 15000,
  });

  const loadError = isError;
  const realtimeStatus: RealtimeStatus = isLive
    ? "connected"
    : loadError
      ? "error"
      : "connecting";

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  if (isPending && !data) {
    return <QueueBoardSkeleton />;
  }

  const display = data?.display ?? DEFAULT_DISPLAY;
  const rooms = (data?.rooms ?? []) as RoomPanel[];
  const waiting = ((data?.waiting ?? []) as WaitingItem[]).slice(0, 5);
  const avgServiceTime = data?.avg_service_time ?? 10;

  const timeStr = now
    ? now.toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";

  const themeColor = display.theme_color || CAREQ_DEFAULT_THEME_COLOR;
  const isReconnecting = loadError || realtimeStatus !== "connected";
  const dotLabel = isReconnecting ? "Reconnecting" : "Live";

  return (
    <div
      className={cn(
        "relative flex flex-col lg:flex-row h-screen overflow-hidden",
        tvMode ? "bg-zinc-950" : "bg-surface"
      )}
      aria-busy={isFetching}
    >
      {tvMode ? (
        <div
          className="absolute top-4 right-4 z-20"
          title={dotLabel}
          aria-label={dotLabel}
        >
          <span
            className={cn(
              "inline-block h-3 w-3 rounded-full",
              isReconnecting ? "bg-amber-500" : "bg-emerald-500 motion-safe:animate-pulse"
            )}
          />
        </div>
      ) : loadError ? (
        <div className="absolute top-0 left-0 right-0 z-10 bg-destructive text-destructive-foreground text-center text-body-sm py-2">
          Unable to load queue data. Retrying...
        </div>
      ) : null}

      <div
        className={cn(
          "w-full lg:w-2/3 flex flex-col p-6 md:p-8 overflow-y-auto text-primary-foreground min-h-[50vh] lg:min-h-0",
          tvMode && "lg:w-3/4"
        )}
        style={{ backgroundColor: tvMode ? "#0f172a" : themeColor }}
      >
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1
              className={cn(
                "font-bold truncate",
                tvMode ? "text-2xl md:text-3xl" : "text-headline-sm"
              )}
            >
              {display.display_name}
            </h1>
            {display.location && (
              <p className={cn("opacity-80 truncate", tvMode ? "text-lg" : "text-body-sm")}>
                {display.location}
              </p>
            )}
          </div>
          <div
            data-testid="queue-clock"
            className={cn("font-mono shrink-0 tabular-nums", tvMode ? "text-3xl" : "text-xl")}
          >
            {timeStr}
          </div>
        </div>

        <h2
          className={cn(
            "uppercase tracking-widest text-center mb-6 opacity-90",
            tvMode ? "text-xl font-semibold" : "text-label-md"
          )}
        >
          Now serving
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6 flex-1">
          {rooms.map((room) => (
            <div
              key={room.id}
              className={cn(
                "current-patient-card text-center flex flex-col justify-center animate-in fade-in duration-300",
                tvMode ? "py-8 px-6 min-h-[200px]" : "py-6 px-4 min-h-[140px]"
              )}
            >
              <p
                className={cn(
                  "font-bold uppercase mb-3",
                  tvMode
                    ? "text-xl text-on-surface"
                    : "text-label-md text-on-surface-variant"
                )}
              >
                {room.name}
              </p>
              {room.current ? (
                <div
                  className={cn(
                    "font-mono-careq font-bold leading-none",
                    tvMode ? "text-headline-lg" : "text-4xl"
                  )}
                  style={{ color: themeColor }}
                >
                  {room.current.queue_number}
                </div>
              ) : (
                <p className="text-body-md text-on-surface-variant py-4">
                  {tvMode ? "—" : "No patient in this room"}
                </p>
              )}
            </div>
          ))}
          {rooms.length === 0 && (
            <p className="col-span-full text-center text-body-md opacity-80 py-8">
              No active rooms configured
            </p>
          )}
        </div>
      </div>

      <div
        className={cn(
          "upcoming-queue-section w-full flex flex-col p-6 md:p-8 overflow-y-auto min-h-[40vh] lg:min-h-0",
          tvMode ? "lg:w-1/4 bg-zinc-900 text-zinc-100" : "lg:w-1/3 bg-surface-container-lowest"
        )}
      >
        <h4
          className={cn(
            "font-bold text-center mb-6 tracking-wide",
            tvMode ? "text-xl text-zinc-100" : "text-headline-sm text-on-surface"
          )}
        >
          Upcoming
          {waiting.length > 0 && (
            <span className="ml-2 text-primary font-mono-careq">({waiting.length})</span>
          )}
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
              const pos = q.position ?? i + 1;
              const estWait = q.est_wait_minutes ?? pos * avgServiceTime;
              const pri = priorityLabel(q.priority);
              return (
                <li
                  key={q.queueId ?? q.id}
                  className="upcoming-item animate-in fade-in duration-300"
                >
                  <div
                    className={cn(
                      "font-mono-careq font-bold shrink-0",
                      tvMode ? "text-body-md text-primary" : "queue-number-sm"
                    )}
                    style={tvMode ? undefined : { color: themeColor }}
                  >
                    {q.queue_number ?? q.id}
                  </div>
                  {!tvMode && (
                    <div className="patient-details min-w-0">
                      <div className="appointment-time flex flex-wrap gap-1 items-center">
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
                              q.priority === "low" &&
                                "bg-surface-container text-on-surface-variant"
                            )}
                          >
                            {pri}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      </div>
    </div>
  );
}

"use client";

import { memo, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  CAREQ_DEFAULT_THEME_COLOR,
  CAREQ_PRIMARY,
} from "@/lib/design-tokens";
import { cn } from "@/lib/utils";
import { useQueueSubscription } from "@/lib/hooks/useQueueSubscription";
import {
  queueDataApi,
  type PublicRoomPanel,
  type PublicWaitingItem,
} from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";

type DisplayConfig = {
  display_name: string;
  location: string;
  theme_color: string;
  show_wait_time: boolean;
  show_priority: boolean;
};

type RoomPanel = PublicRoomPanel;
type WaitingItem = PublicWaitingItem;

type RealtimeStatus = "connecting" | "connected" | "error";

type CalledBanner = {
  ticket: string;
  room: string;
  key: string;
};

const DEFAULT_DISPLAY: DisplayConfig = {
  display_name: "CAREQ",
  location: "",
  theme_color: CAREQ_DEFAULT_THEME_COLOR,
  show_wait_time: true,
  show_priority: true,
};

const PANEL_GRADIENT = `linear-gradient(180deg, ${CAREQ_PRIMARY}, #003a9e)`;
const UPCOMING_LIMIT = 6;
const COMPACT_TABLE_THRESHOLD = 9;

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

function roomStatus(room: RoomPanel): "empty" | "occupied" | "called" {
  if (!room.current) return "empty";
  if (room.current.status === "called") return "called";
  return "occupied";
}

/** Isolated clock — 1s ticks must not re-render room cards. */
const ClockDisplay = memo(function ClockDisplay({
  className,
  large,
}: {
  className?: string;
  large?: boolean;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);

  const timeStr = now
    ? now.toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "--:--:--";

  return (
    <div
      data-testid="queue-clock"
      className={cn(
        "font-mono shrink-0 tabular-nums text-white",
        large ? "text-[28px] tracking-[0.05em]" : "text-xl",
        className
      )}
    >
      {timeStr}
    </div>
  );
});

function LiveDot({
  isReconnecting,
  label,
}: {
  isReconnecting: boolean;
  label: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-2 shrink-0"
      title={label}
      aria-label={label}
    >
      <span
        className={cn(
          "inline-block h-2.5 w-2.5 rounded-full",
          isReconnecting
            ? "bg-amber-400"
            : "bg-emerald-400 motion-safe:animate-pulse"
        )}
      />
      <span className="text-[14px] font-semibold uppercase tracking-[0.08em] text-white/80">
        {label}
      </span>
    </span>
  );
}

function StatusBadge({ status }: { status: "empty" | "occupied" | "called" }) {
  if (status === "called") {
    return (
      <span
        className={cn(
          "status-badge-called inline-flex items-center rounded-[10px] px-2.5 py-1",
          "text-[14px] font-extrabold uppercase tracking-wide text-white bg-destructive"
        )}
      >
        Called
      </span>
    );
  }
  if (status === "occupied") {
    return (
      <span className="inline-flex items-center rounded-[10px] px-2.5 py-1 text-[14px] font-extrabold uppercase tracking-wide text-white bg-primary">
        Serving
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-[10px] px-2.5 py-1 text-[14px] font-extrabold uppercase tracking-wide text-on-surface-variant bg-surface-container">
      Empty
    </span>
  );
}

const RoomCard = memo(function RoomCard({
  room,
  themeColor,
}: {
  room: RoomPanel;
  themeColor: string;
}) {
  const status = roomStatus(room);
  const isEmpty = status === "empty";
  const isCalled = status === "called";
  const isOccupied = status === "occupied";
  const contentKey = `${room.current?.queue_number ?? "empty"}:${status}`;

  return (
    <div
      className={cn(
        "flex min-h-[250px] flex-col justify-center rounded-2xl px-6 py-8 text-center shadow-[0_4px_12px_rgba(0,0,0,0.10)]",
        isEmpty && "bg-surface-container-lowest opacity-70",
        isOccupied && "bg-primary/10",
        isCalled && "bg-surface-container-lowest called-card-border"
      )}
    >
      <p className="mb-4 text-[15px] font-extrabold uppercase tracking-[0.07em] text-on-surface-variant">
        {room.name}
      </p>

      <div
        key={contentKey}
        className="queue-board-card-content flex flex-col items-center"
      >
        {isEmpty ? (
          <p className="text-center text-[16px] font-medium leading-relaxed text-on-surface-variant">
            No patient in this room
          </p>
        ) : isCalled && room.current ? (
          <>
            <div className="font-mono-careq mb-3.5 text-[42px] font-extrabold leading-none text-primary">
              {room.current.queue_number}
            </div>
            {room.current.doctor_name && (
              <p className="truncate max-w-full text-[15px] font-bold text-primary">
                {room.current.doctor_name}
              </p>
            )}
            <p className="mt-3 text-[14px] font-extrabold uppercase tracking-[0.08em] text-destructive">
              Please proceed
            </p>
            <p className="mt-1 text-[15px] font-extrabold text-primary">
              → {room.name}
            </p>
          </>
        ) : room.current ? (
          <>
            <div
              className="font-mono-careq mb-3.5 text-[38px] font-extrabold leading-none"
              style={{ color: themeColor || CAREQ_PRIMARY }}
            >
              {room.current.queue_number}
            </div>
            {room.current.doctor_name && (
              <p className="truncate max-w-full text-[15px] font-bold text-primary">
                {room.current.doctor_name}
              </p>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
});

function CompactTableView({ rooms }: { rooms: RoomPanel[] }) {
  return (
    <div className="overflow-auto rounded-2xl bg-surface-container-lowest shadow-[0_4px_12px_rgba(0,0,0,0.10)]">
      <table className="w-full border-collapse text-left">
        <thead className="sticky top-0 z-10">
          <tr className="bg-surface-container-low">
            {["Room", "Ticket", "Doctor", "Status"].map((label) => (
              <th
                key={label}
                className="px-4 py-3 text-[14px] font-extrabold uppercase tracking-[0.07em] text-on-surface-variant"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rooms.map((room, index) => {
            const status = roomStatus(room);
            return (
              <tr
                key={room.id}
                className={cn(
                  index % 2 === 0 ? "bg-surface-container-lowest" : "bg-surface-container-low",
                  status === "called" && "border-l-[3px] border-l-destructive"
                )}
              >
                <td className="h-14 px-4 py-3 text-[17px] font-bold text-on-surface">
                  {room.name}
                </td>
                <td className="h-14 px-4 py-3 font-mono-careq text-[19px] font-extrabold text-primary">
                  {room.current?.queue_number ?? "—"}
                </td>
                <td className="h-14 max-w-[10rem] truncate px-4 py-3 text-[17px] font-semibold text-primary">
                  {room.current?.doctor_name ?? "—"}
                </td>
                <td className="h-14 px-4 py-3">
                  <StatusBadge status={status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CardGridView({
  rooms,
  themeColor,
}: {
  rooms: RoomPanel[];
  themeColor: string;
}) {
  return (
    <div className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 md:gap-6">
      {rooms.map((room) => (
        <RoomCard key={room.id} room={room} themeColor={themeColor} />
      ))}
      {rooms.length === 0 && (
        <p className="col-span-full py-8 text-center text-[16px] text-white/80">
          No active rooms configured
        </p>
      )}
    </div>
  );
}

/** NEW ADDITION: called notification banner below topbar (keeps clock visible). */
function CalledNotificationBanner({
  banner,
  exiting,
}: {
  banner: CalledBanner;
  exiting: boolean;
}) {
  return (
    <div
      className={cn(
        "mb-4 overflow-hidden rounded-[10px] px-4 py-3 text-center",
        exiting ? "called-banner-slide-out" : "called-banner-slide-in"
      )}
      style={{ backgroundColor: "hsl(var(--destructive))" }}
      role="alert"
      aria-live="assertive"
    >
      <p className="text-[20px] font-extrabold leading-snug tracking-[0.04em] text-white md:text-[24px]">
        <span className="whitespace-nowrap">NOW CALLING — {banner.ticket}</span>
        <span className="mx-2 hidden sm:inline">—</span>
        <span className="mt-1 block sm:mt-0 sm:inline">
          PLEASE PROCEED TO {banner.room.toUpperCase()}
        </span>
      </p>
    </div>
  );
}

export function QueueBoard({ screenId }: { screenId?: string }) {
  const searchParams = useSearchParams();
  const tvMode = searchParams.get("theme") === "tv";

  const { data, isPending, isError, isFetching } = useQuery({
    queryKey: queryKeys.queue.public(screenId),
    queryFn: () => queueDataApi.public(screenId),
    staleTime: 3_000,
  });

  const { isLive } = useQueueSubscription({
    channelName: `queue-board-${screenId ?? "default"}`,
    queryKey: queryKeys.queue.public(screenId),
    fallbackIntervalMs: 15_000,
  });

  const loadError = isError;
  const realtimeStatus: RealtimeStatus = isLive
    ? "connected"
    : loadError
      ? "error"
      : "connecting";

  const display = data?.display ?? DEFAULT_DISPLAY;
  const rooms = (data?.rooms ?? []) as RoomPanel[];
  const waiting = ((data?.waiting ?? []) as WaitingItem[]).slice(0, UPCOMING_LIMIT);
  const avgServiceTime = data?.avg_service_time ?? 10;
  const themeColor = display.theme_color || CAREQ_DEFAULT_THEME_COLOR;
  const useCompactTable = rooms.length >= COMPACT_TABLE_THRESHOLD;

  // NEW ADDITION: called notification banner state
  const [calledBanner, setCalledBanner] = useState<CalledBanner | null>(null);
  const [bannerExiting, setBannerExiting] = useState(false);
  const seenCalledKeysRef = useRef<Set<string>>(new Set());
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bannerExitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hydratedRef = useRef(false);

  useEffect(() => {
    if (!data?.rooms) return;

    const boardRooms = data.rooms as RoomPanel[];
    const calledRooms = boardRooms.filter(
      (r) => roomStatus(r) === "called" && r.current
    );
    const activeKeys = new Set(
      calledRooms.map((r) => `${r.id}:${r.current!.queue_number}`)
    );

    // Seed seen keys on first data load so we don't flash banners for already-called patients
    if (!hydratedRef.current) {
      seenCalledKeysRef.current = activeKeys;
      hydratedRef.current = true;
      return;
    }

    for (const room of calledRooms) {
      if (!room.current) continue;
      const key = `${room.id}:${room.current.queue_number}`;
      if (seenCalledKeysRef.current.has(key)) continue;

      seenCalledKeysRef.current.add(key);

      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (bannerExitTimerRef.current) clearTimeout(bannerExitTimerRef.current);

      setBannerExiting(false);
      setCalledBanner({
        ticket: room.current.queue_number,
        room: room.name,
        key,
      });

      // Hold ~6s visible, then 300ms slide-out
      bannerTimerRef.current = setTimeout(() => {
        setBannerExiting(true);
        bannerExitTimerRef.current = setTimeout(() => {
          setCalledBanner(null);
          setBannerExiting(false);
        }, 300);
      }, 6000);

      break;
    }

    Array.from(seenCalledKeysRef.current).forEach((key) => {
      if (!activeKeys.has(key)) seenCalledKeysRef.current.delete(key);
    });
  }, [data]);

  useEffect(() => {
    return () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      if (bannerExitTimerRef.current) clearTimeout(bannerExitTimerRef.current);
    };
  }, []);

  const isReconnecting = loadError || realtimeStatus !== "connected";
  const dotLabel = isReconnecting ? "Reconnecting" : "Live";
  const showInitialSkeleton = isPending && !data;

  return (
    <div
      className={cn(
        "queue-board relative flex h-screen flex-col overflow-hidden lg:flex-row",
        tvMode ? "bg-surface-container-low" : "bg-surface"
      )}
      aria-busy={isFetching || showInitialSkeleton}
    >
      {!tvMode && loadError ? (
        <div className="absolute left-0 right-0 top-0 z-10 bg-destructive py-2 text-center text-body-sm text-destructive-foreground">
          Unable to load queue data. Retrying...
        </div>
      ) : null}

      {/* Left panel — Now Serving (70%) — chrome always mounts so clock/headings stay testable */}
      <div
        className="relative flex min-h-[50vh] w-full flex-col overflow-y-auto p-4 text-primary-foreground sm:p-6 md:p-8 lg:min-h-0 lg:w-[70%]"
        style={
          tvMode
            ? { background: PANEL_GRADIENT }
            : { backgroundColor: themeColor }
        }
      >
        <div className="mb-6 flex items-center justify-between gap-4 border-b border-white/15 pb-4">
          <div className="min-w-0">
            <h1
              className={cn(
                "truncate font-extrabold tracking-[0.02em] text-white",
                tvMode ? "text-[30px]" : "text-headline-sm"
              )}
            >
              {display.display_name}
            </h1>
            {display.location && (
              <p
                className={cn(
                  "truncate text-white/80",
                  tvMode ? "text-lg" : "text-body-sm"
                )}
              >
                {display.location}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
            {tvMode && (
              <LiveDot isReconnecting={isReconnecting} label={dotLabel} />
            )}
            <ClockDisplay large={tvMode} />
          </div>
        </div>

        {calledBanner && (
          <CalledNotificationBanner banner={calledBanner} exiting={bannerExiting} />
        )}

        <h2 className="mb-6 text-center text-[14px] font-extrabold uppercase tracking-[0.14em] text-primary-foreground/80">
          Now serving
        </h2>

        {showInitialSkeleton ? (
          <div className="grid flex-1 grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-4 md:gap-6" aria-hidden>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="min-h-[250px] animate-pulse rounded-2xl bg-white/20"
              />
            ))}
          </div>
        ) : useCompactTable ? (
          <CompactTableView rooms={rooms} />
        ) : (
          <CardGridView rooms={rooms} themeColor={themeColor} />
        )}
      </div>

      {/* Right panel — Upcoming (30%) */}
      <div
        className={cn(
          "upcoming-queue-section flex min-h-[40vh] w-full flex-col overflow-y-auto border-t border-outline-variant p-4 sm:p-6 md:p-8 lg:min-h-0 lg:w-[30%] lg:border-l lg:border-t-0",
          tvMode ? "bg-surface-container-lowest text-on-surface" : "bg-surface-container-lowest"
        )}
      >
        <h3
          className={cn(
            "mb-6 font-extrabold tracking-wide",
            tvMode
              ? "text-left text-[21px] text-on-surface"
              : "text-center text-headline-sm text-on-surface"
          )}
        >
          Upcoming
          {waiting.length > 0 && (
            <span className="ml-2 font-mono-careq text-primary">
              ({waiting.length})
            </span>
          )}
        </h3>

        <ul className="upcoming-list flex-1">
          {waiting.length === 0 ? (
            <li className="flex flex-1 items-center justify-center py-8">
              <div className="text-center text-[16px] leading-relaxed text-on-surface-variant">
                No upcoming patients
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
                  className={cn(
                    "flex items-center justify-between gap-3 border-b border-outline-variant py-4",
                    !tvMode && "upcoming-item"
                  )}
                >
                  <div
                    className={cn(
                      "font-mono-careq shrink-0 rounded-md bg-surface-container px-[11px] py-1 text-[15px] font-extrabold text-on-surface",
                      !tvMode && "queue-number-sm bg-transparent px-0 py-0"
                    )}
                    style={!tvMode ? { color: themeColor } : undefined}
                  >
                    {q.queue_number ?? q.id}
                  </div>

                  {tvMode ? (
                    display.show_wait_time ? (
                      <span className="shrink-0 text-right text-[14px] font-medium tabular-nums text-on-surface-variant">
                        ~{estWait} min
                      </span>
                    ) : null
                  ) : (
                    <div className="patient-details min-w-0">
                      <div className="appointment-time flex flex-wrap items-center gap-1">
                        <span className="position-badge">{ordinal(pos)} in line</span>
                        {display.show_wait_time && (
                          <span className="est-wait-badge">~{estWait} min</span>
                        )}
                        {display.show_priority && pri && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-label-sm font-semibold uppercase",
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

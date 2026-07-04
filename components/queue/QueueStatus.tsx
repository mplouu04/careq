"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Megaphone,
} from "lucide-react";
import { CareqCard, StatusBadge, CareqButton } from "@/components/careq";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Hourglass } from "lucide-react";
import { useRealtimePoll } from "@/lib/hooks/useRealtimePoll";
import { normalizeQueueRef } from "@/lib/queue-ref";
import { isCalledLikeStatus } from "@/lib/queue-status";

type QueueEntry = {
  id: number;
  queue_number: string;
  status: string;
  called_at?: string | null;
  room_id?: string | null;
  checkins?: {
    patients?: { first_name: string; last_name: string } | null;
    staff?: { first_name: string; last_name: string } | null;
  } | null;
};

const HEADER_BG: Record<string, string> = {
  waiting: "bg-primary",
  called: "bg-status-called",
  in_progress: "bg-status-called",
  completed: "bg-muted-foreground",
  cancelled: "bg-destructive",
  no_show: "bg-status-no-show",
};

function statusBadgeVariant(
  status: string
): "waiting" | "called" | "completed" | "error" | "no_show" {
  if (status === "waiting") return "waiting";
  if (isCalledLikeStatus(status)) return "called";
  if (status === "completed") return "completed";
  if (status === "no_show") return "no_show";
  return "error";
}

/** Synthesise a short two-tone ascending chime (called). */
function playCalledChime() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    gain.connect(ctx.destination);

    [880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.25);
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.25);
      osc.stop(ctx.currentTime + i * 0.25 + 0.5);
    });
  } catch {
    // AudioContext unavailable — silently skip
  }
}

/** Softer single-tone chime for "approaching turn". */
function playApproachingChime() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.connect(gain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    // AudioContext unavailable — silently skip
  }
}

/** Descending two-tone chime for "missed turn". */
function playMissedChime() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.0);
    gain.connect(ctx.destination);

    [440, 330].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.3);
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.3);
      osc.stop(ctx.currentTime + i * 0.3 + 0.4);
    });
  } catch {
    // AudioContext unavailable — silently skip
  }
}

/** Fire a browser Notification if permission is granted (or request it first). */
function fireBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  const send = () => new Notification(title, { body, icon: "/icon-192.png" });
  if (Notification.permission === "granted") {
    send();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((p) => { if (p === "granted") send(); });
  }
}

function fireCalledNotification(queueNumber: string, room: string) {
  fireBrowserNotification(
    "It's your turn!",
    `Queue ${queueNumber} — please proceed${room ? ` to ${room}` : ""}.`
  );
}

function fireApproachingNotification(queueNumber: string, position: number) {
  fireBrowserNotification(
    "You're almost up!",
    `Queue ${queueNumber} is now position ${position} — please stay nearby.`
  );
}

function fireMissedNotification(queueNumber: string) {
  fireBrowserNotification(
    "You missed your turn",
    `Queue ${queueNumber} — please see the front desk to rejoin the queue.`
  );
}

export function QueueStatus({ refNumber }: { refNumber: string }) {
  const [queue, setQueue] = useState<QueueEntry | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [estWait, setEstWait] = useState<number | null>(null);
  const [room, setRoom] = useState("");
  const [doctor, setDoctor] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const prevStatusRef = useRef<string | null>(null);
  const prevPositionRef = useRef<number | null>(null);

  // Only fire notifications when the user has opted in
  useEffect(() => {
    if (!alertsEnabled) return;
    const current = queue?.status ?? null;
    if (!isCalledLikeStatus(prevStatusRef.current) && isCalledLikeStatus(current)) {
      playCalledChime();
      fireCalledNotification(queue?.queue_number ?? "", room);
    }
    if (prevStatusRef.current !== "no_show" && current === "no_show") {
      playMissedChime();
      fireMissedNotification(queue?.queue_number ?? "");
    }
    prevStatusRef.current = current;
  }, [queue?.status, queue?.queue_number, room, alertsEnabled]);

  // Fire approaching-turn alert when position drops to 2 or fewer
  useEffect(() => {
    if (!alertsEnabled) return;
    const prev = prevPositionRef.current;
    prevPositionRef.current = position;
    if (
      queue?.status === "waiting" &&
      position !== null &&
      position <= 2 &&
      (prev === null || prev > 2)
    ) {
      playApproachingChime();
      fireApproachingNotification(queue.queue_number, position);
    }
  }, [position, queue?.status, queue?.queue_number, alertsEnabled]);

  async function enableAlerts() {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    setAlertsEnabled(permission === "granted");
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/queue?ref=${encodeURIComponent(refNumber)}`, {
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));

      if (res.status === 404 || (res.ok && !data.success)) {
        setLoadError(false);
        setRateLimited(false);
        setNotFound(true);
        return;
      }

      if (res.status === 429) {
        setLoadError(false);
        setNotFound(false);
        setRateLimited(true);
        return;
      }

      if (!res.ok || !data.success) {
        setNotFound(false);
        setRateLimited(false);
        setLoadError(true);
        return;
      }

      setLoadError(false);
      setNotFound(false);
      setRateLimited(false);
      setQueue(data.queue);
      setPosition(data.position ?? null);
      setEstWait(data.est_wait_minutes ?? null);
      setRoom(data.room ?? "");
      setDoctor(data.doctor ?? "");
    } catch {
      setNotFound(false);
      setRateLimited(false);
      setLoadError(true);
    }
  }, [refNumber]);

  const normalizedRef = useMemo(() => normalizeQueueRef(refNumber), [refNumber]);

  const subscribeQueue = useMemo(
    () => (onChange: () => void) => {
      const supabase = createClient();
      return supabase
        .channel(`queue-status-${normalizedRef}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "queue",
            filter: `queue_number=eq.${normalizedRef}`,
          },
          onChange
        );
    },
    [normalizedRef]
  );

  const { isLive } = useRealtimePoll({
    fetchFn: load,
    subscribe: subscribeQueue,
    fallbackIntervalMs: 5000,
    livePollIntervalMs: 0,
    heartbeatIntervalMs: 15000,
  });

  if (rateLimited) {
    return (
      <div className="max-w-md mx-auto">
        <CareqCard className="p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-headline-sm text-on-surface mb-1">Too many requests</p>
          <p className="text-body-sm text-on-surface-variant mb-4">
            Wait a moment and try again.
          </p>
          <CareqButton type="button" onClick={load} className="cursor-pointer">
            Retry
          </CareqButton>
        </CareqCard>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-md mx-auto">
        <CareqCard className="p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-destructive mx-auto mb-3" />
          <p className="text-headline-sm text-on-surface mb-1">Connection error</p>
          <p className="text-body-sm text-on-surface-variant mb-4">Unable to load status.</p>
          <CareqButton type="button" onClick={load} className="cursor-pointer">
            Retry
          </CareqButton>
        </CareqCard>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-md mx-auto">
        <CareqCard className="p-6 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <p className="text-headline-sm text-on-surface mb-1">Queue entry not found</p>
          <p className="text-body-sm text-on-surface-variant mb-4 font-mono-careq">{refNumber}</p>
          <Link href="/status" className="text-primary hover:underline text-body-sm">
            Check another number
          </Link>
        </CareqCard>
      </div>
    );
  }

  if (!queue) {
    return (
      <div className="max-w-md mx-auto">
        <CareqCard className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-body-sm text-on-surface-variant">Loading…</p>
        </CareqCard>
      </div>
    );
  }

  const headerBg = HEADER_BG[queue.status] ?? "bg-muted-foreground";
  const statusLabel =
    queue.status === "waiting"
      ? "Waiting"
      : isCalledLikeStatus(queue.status)
        ? "Called"
        : queue.status === "completed"
          ? "Done"
          : queue.status === "no_show"
            ? "No show"
            : "Cancelled";

  return (
    <div className="max-w-lg mx-auto">
      <CareqCard className="overflow-hidden border-outline-variant">
        <div className={cn("px-6 py-5 text-primary-foreground", headerBg)}>
          <StatusBadge
            status={statusBadgeVariant(queue.status)}
            label={statusLabel}
            icon={queue.status === "waiting" ? Hourglass : isCalledLikeStatus(queue.status) ? Megaphone : undefined}
            className="bg-white/20 text-white border-0 mb-3"
          />
          <p
            className="text-headline-lg font-mono-careq font-bold text-center"
            aria-live="polite"
            aria-atomic="true"
          >
            {queue.queue_number}
          </p>
        </div>

        <div className="px-5 py-6 text-center">
          {queue.status === "waiting" && (
            <>
              {position !== null && (
                <p className="text-body-md text-on-surface mb-1" aria-live="polite">
                  Position <strong>{position}</strong>
                </p>
              )}
              {estWait !== null && (
                <p className="text-body-sm text-on-surface-variant">~{estWait} min wait</p>
              )}
            </>
          )}

          {isCalledLikeStatus(queue.status) && (
            <>
              <div className="called-banner rounded-lg p-4 mb-4 bg-status-called text-white">
                <p className="text-headline-md font-semibold">{room || "Your room"}</p>
                {doctor && <p className="text-body-sm mt-1 opacity-90">{doctor}</p>}
                <p className="text-body-sm mt-1">Please proceed</p>
              </div>
            </>
          )}

          {queue.status === "completed" && (
            <>
              <CheckCircle2 className="w-12 h-12 text-status-called mx-auto mb-3" />
              <p className="text-headline-sm text-on-surface mb-1">Visit complete</p>
              <p className="text-body-sm text-on-surface-variant mb-4">Thank you for visiting.</p>
              <Button variant="ghost" asChild className="cursor-pointer">
                <Link href="/">Home</Link>
              </Button>
            </>
          )}

          {queue.status === "cancelled" && (
            <>
              <XCircle className="w-12 h-12 text-destructive mx-auto mb-3" />
              <p className="text-headline-sm text-on-surface mb-1">Cancelled</p>
              <p className="text-body-sm text-on-surface-variant mb-4">See the front desk.</p>
              <Button variant="ghost" asChild className="cursor-pointer">
                <Link href="/">Home</Link>
              </Button>
            </>
          )}

          {queue.status === "no_show" && (
            <>
              <XCircle className="w-12 h-12 text-status-no-show mx-auto mb-3" />
              <p className="text-headline-sm text-on-surface mb-1">Marked no show</p>
              <p className="text-body-sm text-on-surface-variant mb-4">See the front desk to rejoin.</p>
              <CareqButton asChild className="cursor-pointer">
                <Link href="/visit">Check in again</Link>
              </CareqButton>
            </>
          )}
        </div>
      </CareqCard>

      <div className="text-center mt-3">
        {!alertsEnabled && typeof window !== "undefined" && "Notification" in window && (
          <CareqButton
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer mb-2"
            onClick={() => void enableAlerts()}
          >
            Enable sound &amp; alerts
          </CareqButton>
        )}
        {alertsEnabled && (
          <p className="text-label-sm text-on-surface-variant mb-2">Alerts enabled</p>
        )}
      </div>

      <div className="text-center mt-3">
        <span
          className={cn(
            "inline-flex items-center gap-1 text-label-sm px-2 py-1 rounded-full",
            isLive ? "text-green-700 bg-green-50" : "text-amber-700 bg-amber-50"
          )}
        >
          <span
            className={cn("w-1.5 h-1.5 rounded-full", isLive ? "bg-green-500" : "bg-amber-500")}
          />
          {isLive ? "Live updates" : "Connecting..."}
        </span>
      </div>

      <div className="text-center mt-3">
        <Link href="/status" className="text-body-sm text-primary hover:underline">
          Check another number
        </Link>
      </div>
    </div>
  );
}

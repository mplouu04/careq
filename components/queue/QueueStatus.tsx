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
  in_progress: "bg-status-called",
  completed: "bg-muted-foreground",
  cancelled: "bg-destructive",
  no_show: "bg-status-no-show",
};

function statusBadgeVariant(
  status: string
): "waiting" | "called" | "completed" | "error" | "no_show" {
  if (status === "waiting") return "waiting";
  if (status === "in_progress") return "called";
  if (status === "completed") return "completed";
  if (status === "no_show") return "no_show";
  return "error";
}

/** Synthesise a short two-tone chime via Web Audio API (no file needed). */
function playCalledChime() {
  try {
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
    gain.connect(ctx.destination);

    const tones = [880, 1100];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.25);
      osc.connect(gain);
      osc.start(ctx.currentTime + i * 0.25);
      osc.stop(ctx.currentTime + i * 0.25 + 0.5);
    });
  } catch {
    // AudioContext unavailable (e.g. server-side) — silently skip
  }
}

/** Request browser notification permission once; fire a notification if granted. */
function fireCalledNotification(queueNumber: string, room: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  const send = () => {
    new Notification("It's your turn!", {
      body: `Queue ${queueNumber} — please proceed${room ? ` to ${room}` : ""}.`,
      icon: "/icon-192.png",
    });
  };
  if (Notification.permission === "granted") {
    send();
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((p) => {
      if (p === "granted") send();
    });
  }
}

export function QueueStatus({ refNumber }: { refNumber: string }) {
  const [queue, setQueue] = useState<QueueEntry | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [estWait, setEstWait] = useState<number | null>(null);
  const [room, setRoom] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const prevStatusRef = useRef<string | null>(null);

  // Request notification permission proactively on mount
  useEffect(() => {
    if (typeof window !== "undefined" && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  // Fire chime + browser notification when status transitions to in_progress
  useEffect(() => {
    const current = queue?.status ?? null;
    if (prevStatusRef.current !== "in_progress" && current === "in_progress") {
      playCalledChime();
      fireCalledNotification(queue?.queue_number ?? "", room);
    }
    prevStatusRef.current = current;
  }, [queue?.status, queue?.queue_number, room]);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/queue?ref=${encodeURIComponent(refNumber)}`);
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json();
      if (!data.success) {
        setNotFound(true);
        return;
      }
      setLoadError(false);
      setNotFound(false);
      setQueue(data.queue);
      setPosition(data.position ?? null);
      setEstWait(data.est_wait_minutes ?? null);
      setRoom(data.room ?? "");
    } catch {
      setLoadError(true);
    }
  }, [refNumber]);

  const subscribeQueue = useMemo(
    () => (onChange: () => void) => {
      const supabase = createClient();
      return supabase
        .channel(`queue-status-${refNumber}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, onChange);
    },
    [refNumber]
  );

  useRealtimePoll({
    fetchFn: load,
    subscribe: subscribeQueue,
    fallbackIntervalMs: 5000,
  });

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
      : queue.status === "in_progress"
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
            icon={queue.status === "waiting" ? Hourglass : queue.status === "in_progress" ? Megaphone : undefined}
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

          {queue.status === "in_progress" && (
            <>
              <div className="called-banner rounded-lg p-4 mb-4 bg-status-called text-white">
                <p className="text-headline-md font-semibold">{room || "Your room"}</p>
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

      <div className="text-center mt-4">
        <Link href="/status" className="text-body-sm text-primary hover:underline">
          Check another number
        </Link>
      </div>
    </div>
  );
}

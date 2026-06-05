"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  User,
  MapPin,
  Megaphone,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { CareqCard, StatusBadge, CareqButton } from "@/components/careq";
import { cn } from "@/lib/utils";

type QueueEntry = {
  id: number;
  queue_number: string;
  status: string;
  called_at?: string | null;
  room_id?: string | null;
  skip_count?: number;
  checkins?: {
    reference_number?: string;
    reason?: string;
    patients?: { first_name: string; last_name: string } | null;
    staff?: { first_name: string; last_name: string } | null;
    appointment_types?: { name: string } | null;
  } | null;
};

const TERMINAL = ["completed", "cancelled", "no_show"];

const HEADER_BG: Record<string, string> = {
  waiting: "bg-primary",
  in_progress: "bg-status-called",
  completed: "bg-muted-foreground",
  cancelled: "bg-destructive",
  no_show: "bg-status-no-show",
};

function ordinal(n: number) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function statusBadgeVariant(
  status: string
): "waiting" | "called" | "completed" | "error" | "no_show" {
  if (status === "waiting") return "waiting";
  if (status === "in_progress") return "called";
  if (status === "completed") return "completed";
  if (status === "no_show") return "no_show";
  return "error";
}

export function QueueStatus({ refNumber }: { refNumber: string }) {
  const [queue, setQueue] = useState<QueueEntry | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [patientsAhead, setPatientsAhead] = useState<number | null>(null);
  const [estWait, setEstWait] = useState<number | null>(null);
  const [doctor, setDoctor] = useState("");
  const [room, setRoom] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

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
      setPatientsAhead(data.patients_ahead ?? null);
      setEstWait(data.est_wait_minutes ?? null);
      setDoctor(data.doctor ?? "");
      setRoom(data.room ?? "");
    } catch {
      setLoadError(true);
    }
  }, [refNumber]);

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel("queue-status-" + refNumber)
      .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () =>
        load()
      )
      .subscribe();

    const interval = setInterval(load, 3000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [refNumber, load]);

  if (loadError) {
    return (
      <div className="max-w-md mx-auto">
        <CareqCard className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <p className="font-medium text-foreground mb-1">Connection error</p>
          <p className="text-body-sm text-on-surface-variant mb-4">
            Unable to load queue status. Retrying automatically.
          </p>
          <Link href="/status" className="text-primary hover:underline text-body-sm">
            Check another number
          </Link>
        </CareqCard>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-md mx-auto">
        <CareqCard className="p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <p className="font-medium text-foreground mb-1">Queue entry not found</p>
          <p className="text-body-sm text-on-surface-variant mb-4">
            <strong>{refNumber}</strong> was not found in today&apos;s queue.
          </p>
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
          <p className="text-on-surface-variant">Loading queue status...</p>
        </CareqCard>
      </div>
    );
  }

  const checkin = queue.checkins;
  const patientRaw = checkin?.patients;
  const patientObj = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as
    | { first_name: string; last_name: string }
    | null
    | undefined;
  const typeRaw = checkin?.appointment_types;
  const apptType = (Array.isArray(typeRaw) ? typeRaw[0] : typeRaw) as
    | { name: string }
    | null
    | undefined;

  const name = patientObj ? `${patientObj.first_name} ${patientObj.last_name}` : "";
  const reason = apptType?.name ?? checkin?.reason ?? "";
  const headerBg = HEADER_BG[queue.status] ?? "bg-muted-foreground";

  const statusLabel =
    queue.status === "waiting"
      ? "Waiting"
      : queue.status === "in_progress"
        ? "Called — Proceed to Room"
        : queue.status === "completed"
          ? "Completed"
          : queue.status === "no_show"
            ? "No Show"
            : "Cancelled";

  return (
    <div className="max-w-lg mx-auto">
      <CareqCard className="overflow-hidden border-outline-variant">
        <div className={cn("px-6 py-6 text-primary-foreground", headerBg)}>
          <div className="flex items-center justify-between gap-3 mb-4">
            <StatusBadge
              status={statusBadgeVariant(queue.status)}
              label={statusLabel}
              className="bg-white/20 text-white border-0"
            />
            {!TERMINAL.includes(queue.status) && (
              <span className="text-label-sm text-white/90 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" aria-hidden />
                Live
              </span>
            )}
          </div>
          <p className="text-label-sm uppercase tracking-wider text-white/80 mb-1">
            Your queue number
          </p>
          <p
            className="font-mono-careq text-[2.5rem] md:text-[3rem] font-bold leading-none tracking-tight"
            aria-live="polite"
            aria-atomic="true"
          >
            {queue.queue_number}
          </p>
          {name && (
            <p className="text-headline-sm mt-2 text-white/95">{name}</p>
          )}
        </div>

        <div className="px-5 py-5">
          {queue.status === "waiting" && (
            <>
              {position !== null && (
                <div
                  className="rounded-xl border-2 border-primary bg-primary/5 p-6 text-center mb-4"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  <p className="text-label-sm text-on-surface-variant uppercase tracking-wide">
                    Your position
                  </p>
                  <p className="text-[3.5rem] md:text-[4rem] leading-none font-bold text-primary font-mono-careq mt-1">
                    {position}
                  </p>
                  <p className="text-body-sm text-on-surface-variant mt-1">{ordinal(position)} in line</p>
                </div>
              )}
              <div
                className={cn(
                  "grid gap-3 mb-4",
                  estWait !== null && patientsAhead !== null && patientsAhead > 0
                    ? "grid-cols-2"
                    : "grid-cols-1"
                )}
                aria-live="polite"
                aria-atomic="true"
              >
                {estWait !== null && (
                  <div className="rounded-xl border border-outline-variant bg-surface-container-low p-4 text-center">
                    <p className="text-label-sm text-on-surface-variant">Est. wait</p>
                    <p className="text-headline-lg text-primary font-bold">~{estWait}m</p>
                  </div>
                )}
                {patientsAhead !== null && patientsAhead > 0 && (
                  <div className="col-span-2 text-body-sm text-on-surface-variant text-center">
                    {patientsAhead} patient{patientsAhead === 1 ? "" : "s"} ahead of you
                  </div>
                )}
              </div>
              <div className="rounded-xl bg-secondary-container/50 border border-outline-variant p-4 mb-4">
                <p className="text-body-sm text-on-surface">
                  Keep this page open. We update automatically when your status changes.
                  SMS reminders may be sent if configured by your clinic.
                </p>
              </div>
              <div className="space-y-1 text-body-sm">
                {reason && <Detail icon={ClipboardIcon} label={`Visit: ${reason}`} />}
              </div>
            </>
          )}

          {queue.status === "in_progress" && (
            <>
              <div className="called-banner rounded-xl p-5 text-center mb-4 bg-status-called text-white">
                <Megaphone className="w-10 h-10 mx-auto mb-2" aria-hidden />
                <p className="text-xl font-bold">Proceed to your room now</p>
              </div>
              {room && (
                <div className="rounded-xl border-2 border-primary bg-primary/5 p-4 mb-4 flex items-center gap-3">
                  <MapPin className="h-8 w-8 text-primary shrink-0" aria-hidden />
                  <div>
                    <p className="text-label-sm text-on-surface-variant">Assigned room</p>
                    <p className="text-headline-sm font-bold text-on-surface">{room}</p>
                  </div>
                </div>
              )}
              <div className="space-y-1 text-body-sm">
                {doctor && <Detail icon={User} label={doctor} />}
                {queue.called_at && (
                  <Detail
                    icon={Clock}
                    label={`Called at ${new Date(queue.called_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}`}
                  />
                )}
              </div>
            </>
          )}

          {queue.status === "completed" && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-16 h-16 text-status-called mx-auto mb-3" />
              <h5 className="text-headline-sm text-foreground mb-1">Visit Completed</h5>
              <p className="text-body-sm text-on-surface-variant mb-4">
                Your visit has been marked as done. Thank you for coming!
              </p>
              <CareqButton variant="outline" asChild>
                <Link href="/">Back to Home</Link>
              </CareqButton>
            </div>
          )}

          {queue.status === "cancelled" && (
            <div className="text-center py-4">
              <XCircle className="w-16 h-16 text-destructive mx-auto mb-3" />
              <h5 className="text-headline-sm text-foreground mb-1">Queue Entry Cancelled</h5>
              <p className="text-body-sm text-on-surface-variant mb-4">
                Please approach the front desk if you need assistance.
              </p>
              <CareqButton variant="outline" asChild>
                <Link href="/">Back to Home</Link>
              </CareqButton>
            </div>
          )}

          {queue.status === "no_show" && (
            <div className="text-center py-4">
              <XCircle className="w-16 h-16 text-status-no-show mx-auto mb-3" />
              <h5 className="text-headline-sm text-foreground mb-1">Marked as No Show</h5>
              <p className="text-body-sm text-on-surface-variant mb-4">
                You did not respond when called. Please see the front desk to rejoin the queue.
              </p>
              <CareqButton variant="outline" asChild>
                <Link href="/visit">Check In Again</Link>
              </CareqButton>
            </div>
          )}
        </div>

        {!TERMINAL.includes(queue.status) && (
          <div
            className="px-4 pb-3 text-center text-label-sm text-on-surface-variant border-t border-outline-variant pt-3"
            aria-live="polite"
          >
            Updated {new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </CareqCard>

      <div className="text-center mt-4">
        <Link href="/status" className="text-body-sm text-primary hover:underline">
          ← Check another number
        </Link>
      </div>

    </div>
  );
}

function Detail({ icon: Icon, label }: { icon: React.ComponentType<{ className?: string }>; label: string }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-border last:border-0">
      <Icon className="w-5 h-5 text-primary shrink-0" />
      <span className="text-foreground">{label}</span>
    </div>
  );
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
      />
    </svg>
  );
}

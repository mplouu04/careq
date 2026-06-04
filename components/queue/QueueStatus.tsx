"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  User,
  Home,
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

const TERMINAL = ["completed", "cancelled"];

const HEADER_BG: Record<string, string> = {
  waiting: "bg-primary",
  in_progress: "bg-status-called",
  completed: "bg-muted-foreground",
  cancelled: "bg-destructive",
};

function ordinal(n: number) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

function statusBadgeVariant(
  status: string
): "waiting" | "called" | "completed" | "error" {
  if (status === "waiting") return "waiting";
  if (status === "in_progress") return "called";
  if (status === "completed") return "completed";
  return "error";
}

export function QueueStatus({ refNumber }: { refNumber: string }) {
  const [queue, setQueue] = useState<QueueEntry | null>(null);
  const [position, setPosition] = useState<number | null>(null);
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
        ? "Called"
        : queue.status === "completed"
          ? "Completed"
          : "Cancelled";

  return (
    <div className="max-w-md mx-auto">
      <CareqCard className="overflow-hidden">
        <div className={cn("px-6 py-8 text-center text-primary-foreground", headerBg)}>
          <StatusBadge
            status={statusBadgeVariant(queue.status)}
            label={statusLabel}
            className="mb-4 bg-white/20 text-white border-0"
          />
          <div className="inline-block font-bold text-headline-lg tracking-widest px-6 py-1 rounded-full bg-white/20 mb-2">
            {queue.queue_number}
          </div>
          {name && <div className="text-headline-sm">{name}</div>}

          {queue.status === "waiting" && position !== null && (
            <div className="w-28 h-28 rounded-full mx-auto mt-4 flex flex-col items-center justify-center bg-white/15">
              <span className="text-4xl font-bold leading-none">{position}</span>
              <span className="text-label-sm uppercase tracking-wider opacity-90 mt-1">
                {ordinal(position)} in line
              </span>
            </div>
          )}

          {queue.status === "in_progress" && (
            <div className="mt-3 text-lg font-semibold flex items-center justify-center gap-2">
              <Megaphone className="w-5 h-5" />
              YOU ARE BEING CALLED
            </div>
          )}
        </div>

        <div className="px-5 py-4">
          {queue.status === "waiting" && (
            <div className="space-y-1 text-body-sm">
              {estWait !== null && (
                <Detail icon={Clock} label={`Estimated wait: ~${estWait} min`} />
              )}
              {reason && <Detail icon={ClipboardIcon} label={`Reason: ${reason}`} />}
              <Detail icon={Clock} label="Please stay nearby. You will be called soon." />
            </div>
          )}

          {queue.status === "in_progress" && (
            <>
              <div className="called-banner rounded-xl p-5 text-center mb-4 bg-status-called text-white">
                <Megaphone className="w-10 h-10 mx-auto mb-2" />
                <div className="text-xl font-bold">Please proceed now!</div>
              </div>
              <div className="space-y-1 text-body-sm">
                {doctor && <Detail icon={User} label={`Doctor: ${doctor}`} />}
                {room && <Detail icon={Home} label={`Room: ${room}`} />}
                {queue.called_at && (
                  <Detail
                    icon={Clock}
                    label={`Called at: ${new Date(queue.called_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}`}
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
        </div>

        {!TERMINAL.includes(queue.status) && (
          <div className="px-4 pb-3 text-center text-label-sm text-on-surface-variant">
            Live updates active ·{" "}
            {new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}
      </CareqCard>

      <div className="text-center mt-4">
        <Link href="/status" className="text-body-sm text-primary hover:underline">
          ← Check another number
        </Link>
      </div>

      <style>{`
        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.4); }
          50% { box-shadow: 0 0 0 14px rgba(34, 197, 94, 0); }
        }
        .called-banner { animation: pulse-green 1.8s ease-in-out infinite; }
      `}</style>
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

"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

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

function ordinal(n: number) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export function QueueStatus({ refNumber }: { refNumber: string }) {
  const [queue, setQueue] = useState<QueueEntry | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [estWait, setEstWait] = useState<number | null>(null);
  const [doctor, setDoctor] = useState<string>("");
  const [room, setRoom] = useState<string>("");
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
      .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () => load())
      .subscribe();
    const interval = setInterval(load, 5000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refNumber]);

  if (loadError) {
    return (
      <div className="max-w-md mx-auto">
        <div className="careq-card p-6 text-center">
          <svg className="w-12 h-12 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="font-medium text-gray-700 mb-1">Connection error</p>
          <p className="text-sm text-gray-500 mb-4">Unable to load queue status. Retrying automatically.</p>
          <Link href="/status" className="text-[#0d6efd] hover:underline text-sm">Check another number</Link>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="max-w-md mx-auto">
        <div className="careq-card p-6 text-center">
          <svg className="w-12 h-12 text-yellow-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <p className="font-medium text-gray-700 mb-1">Queue entry not found</p>
          <p className="text-sm text-gray-500 mb-4">
            <strong>{refNumber}</strong> was not found in today&apos;s queue.
          </p>
          <Link href="/status" className="text-[#0d6efd] hover:underline text-sm">
            Check another number
          </Link>
        </div>
      </div>
    );
  }

  if (!queue) {
    return (
      <div className="max-w-md mx-auto">
        <div className="careq-card p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-[#0d6efd] border-t-transparent rounded-full mx-auto mb-3"></div>
          <p className="text-gray-500">Loading queue status...</p>
        </div>
      </div>
    );
  }

  const checkin = queue.checkins;
  const patientRaw = checkin?.patients;
  const patientObj = (Array.isArray(patientRaw) ? patientRaw[0] : patientRaw) as
    | { first_name: string; last_name: string } | null | undefined;
  const typeRaw = checkin?.appointment_types;
  const apptType = (Array.isArray(typeRaw) ? typeRaw[0] : typeRaw) as { name: string } | null | undefined;

  const name = patientObj ? `${patientObj.first_name} ${patientObj.last_name}` : "";
  const reason = apptType?.name ?? checkin?.reason ?? "";

  const headerColors: Record<string, string> = {
    waiting: "#0d6efd",
    in_progress: "#198754",
    completed: "#6c757d",
    cancelled: "#dc3545",
  };
  const headerColor = headerColors[queue.status] ?? "#6c757d";

  const nowTime = () =>
    new Date().toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="max-w-md mx-auto">
      <style>{`
        @keyframes pulse-green {
          0%, 100% { box-shadow: 0 0 0 0 rgba(25,135,84,0.4); }
          50% { box-shadow: 0 0 0 14px rgba(25,135,84,0); }
        }
        .called-banner { animation: pulse-green 1.8s ease-in-out infinite; }
      `}</style>

      <div className="careq-card overflow-hidden shadow">
        {/* Status header */}
        <div
          className="px-6 py-8 text-center text-white"
          style={{ backgroundColor: headerColor }}
        >
          <div
            className="inline-block font-bold text-4xl tracking-widest px-6 py-1 rounded-full mb-2"
            style={{ background: "rgba(255,255,255,0.2)" }}
          >
            {queue.queue_number}
          </div>
          {name && <div className="mt-1 text-xl">{name}</div>}

          {/* Waiting — position ring */}
          {queue.status === "waiting" && position !== null && (
            <div
              className="w-28 h-28 rounded-full mx-auto mt-4 flex flex-col items-center justify-center"
              style={{ background: "rgba(255,255,255,0.15)" }}
            >
              <span className="text-4xl font-bold leading-none">{position}</span>
              <span className="text-xs uppercase tracking-wider opacity-90 mt-1">
                {ordinal(position)} in line
              </span>
            </div>
          )}

          {/* In progress — called banner header text */}
          {queue.status === "in_progress" && (
            <div className="mt-3 text-lg font-semibold flex items-center justify-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              YOU ARE BEING CALLED
            </div>
          )}
        </div>

        {/* Card body */}
        <div className="px-5 py-4">
          {/* Waiting — details */}
          {queue.status === "waiting" && (
            <>
              {estWait !== null && (
                <div className="flex items-center gap-3 py-2 border-b border-gray-100 text-sm">
                  <svg className="w-5 h-5 text-[#0d6efd] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>Estimated wait: <strong>~{estWait} min</strong></span>
                </div>
              )}
              {reason && (
                <div className="flex items-center gap-3 py-2 border-b border-gray-100 text-sm">
                  <svg className="w-5 h-5 text-[#0d6efd] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span>Reason: <strong>{reason}</strong></span>
                </div>
              )}
              <div className="flex items-center gap-3 py-2 text-sm">
                <svg className="w-5 h-5 text-[#0d6efd] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Please stay nearby. You will be called soon.</span>
              </div>
            </>
          )}

          {/* In progress — pulsing banner + details */}
          {queue.status === "in_progress" && (
            <>
              <div
                className="called-banner rounded-xl p-5 text-center mb-4"
                style={{ backgroundColor: "#198754", color: "white" }}
              >
                <svg className="w-10 h-10 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                <div className="text-xl font-bold">Please proceed now!</div>
              </div>
              {(doctor || room) && (
                <div className="space-y-2">
                  {doctor && (
                    <div className="flex items-center gap-3 py-2 border-b border-gray-100 text-sm">
                      <svg className="w-5 h-5 text-[#0d6efd] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span>Doctor: <strong>{doctor}</strong></span>
                    </div>
                  )}
                  {room && (
                    <div className="flex items-center gap-3 py-2 border-b border-gray-100 text-sm">
                      <svg className="w-5 h-5 text-[#0d6efd] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                      </svg>
                      <span>Room: <strong>{room}</strong></span>
                    </div>
                  )}
                  {queue.called_at && (
                    <div className="flex items-center gap-3 py-2 text-sm">
                      <svg className="w-5 h-5 text-[#0d6efd] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Called at: <strong>{new Date(queue.called_at).toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}</strong></span>
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Completed */}
          {queue.status === "completed" && (
            <div className="text-center py-4">
              <svg className="w-16 h-16 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h5 className="font-bold text-gray-800 mb-1">Visit Completed</h5>
              <p className="text-gray-500 text-sm mb-4">Your visit has been marked as done. Thank you for coming!</p>
              <Link href="/" className="inline-block border border-[#0d6efd] text-[#0d6efd] hover:bg-[#0d6efd] hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Back to Home
              </Link>
            </div>
          )}

          {/* Cancelled */}
          {queue.status === "cancelled" && (
            <div className="text-center py-4">
              <svg className="w-16 h-16 text-red-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h5 className="font-bold text-gray-800 mb-1">Queue Entry Cancelled</h5>
              <p className="text-gray-500 text-sm mb-4">Please approach the front desk if you need assistance.</p>
              <Link href="/" className="inline-block border border-[#0d6efd] text-[#0d6efd] hover:bg-[#0d6efd] hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                Back to Home
              </Link>
            </div>
          )}
        </div>

        {/* Refresh note */}
        {!TERMINAL.includes(queue.status) && (
          <div className="px-4 pb-3 text-center text-xs text-gray-400">
            Live updates active &bull; {nowTime()}
          </div>
        )}
      </div>

      {/* Back link */}
      <div className="text-center mt-4">
        <Link href="/status" className="text-sm text-[#0d6efd] hover:underline">
          ← Check another number
        </Link>
      </div>
    </div>
  );
}

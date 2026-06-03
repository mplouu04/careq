"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type NowServingItem = {
  id: string | number;
  queueId?: number;
  queue_number?: string;
  name: string;
  doctor: string;
  room: string;
  status: string;
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
};

function ordinal(n: number) {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  return `${n}th`;
}

export function QueueBoard() {
  const [nowServing, setNowServing] = useState<NowServingItem[]>([]);
  const [waiting, setWaiting] = useState<WaitingItem[]>([]);
  const [avgServiceTime, setAvgServiceTime] = useState(10);
  const [now, setNow] = useState<Date | null>(null);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/queue/public");
      if (!res.ok) {
        setLoadError(true);
        return;
      }
      const data = await res.json();
      setLoadError(false);
      setNowServing(data.nowServing ?? []);
      setWaiting((data.waiting ?? []).slice(0, 8));
      setAvgServiceTime(data.avg_service_time ?? 10);
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    setNow(new Date());
    load();

    const supabase = createClient();
    const channel = supabase
      .channel("queue-board")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () => load())
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Realtime unavailable — 3s polling continues as fallback
        }
      });

    const interval = setInterval(load, 3000);
    const clock = setInterval(() => setNow(new Date()), 1000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
      clearInterval(clock);
    };
  }, [load]);

  const timeStr = now
    ? now.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "--:--:--";

  const current = nowServing[0] ?? null;

  return (
    <div className="flex flex-col lg:flex-row h-screen overflow-hidden" style={{ backgroundColor: "#f8f9fa" }}>
      {loadError && (
        <div className="absolute top-0 left-0 right-0 z-10 bg-red-600 text-white text-center text-sm py-2">
          Unable to load queue data. Retrying...
        </div>
      )}
      {/* Left panel — NOW SERVING (blue) */}
      <div className="current-patient-section w-full lg:w-2/3 h-1/2 lg:h-auto flex flex-col p-6 overflow-y-auto">
        {/* Header */}
        <div className="text-center mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">CAREQ</h1>
          </div>
          <div className="text-center flex-1">
            <h2 className="text-2xl font-bold text-white tracking-widest">NOW SERVING</h2>
          </div>
          <div className="text-right text-white/80 text-sm">
            <div className="text-xl font-mono text-white">{timeStr}</div>
          </div>
        </div>

        {/* Current patient card */}
        <div className="flex-1 flex items-center justify-center">
          <div className="current-patient-card text-center py-10 px-8 w-full">
            {current ? (
              <>
                <div className="queue-number-lg mb-3">
                  {current.queue_number ?? current.id}
                </div>
                <h3 className="patient-name text-gray-800">{current.name || "—"}</h3>
                <div className="patient-info">
                  <div className="info-item text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>{current.doctor || "—"}</span>
                  </div>
                  <div className="info-item text-gray-500">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span>{current.room || "—"}</span>
                  </div>
                </div>
              </>
            ) : (
              <h3 className="patient-name text-gray-500">No Patient Currently Serving</h3>
            )}
          </div>
        </div>
      </div>

      {/* Right panel — UPCOMING PATIENTS (white) */}
      <div className="upcoming-queue-section w-full lg:w-1/3 h-1/2 lg:h-auto flex flex-col p-6 overflow-y-auto">
        <h4 className="text-xl font-bold text-center text-gray-800 mb-6 tracking-wide">
          UPCOMING PATIENTS
        </h4>
        <ul className="upcoming-list">
          {waiting.length === 0 ? (
            <li className="upcoming-item">
              <div className="patient-details">
                <div className="text-gray-500">No upcoming patients</div>
              </div>
            </li>
          ) : (
            waiting.map((q, i) => {
              const pos = i + 1;
              const estWait = q.est_wait_minutes ?? pos * avgServiceTime;
              return (
                <li key={q.queueId ?? q.id} className="upcoming-item">
                  <div className="queue-number-sm">{q.queue_number ?? q.id}</div>
                  <div className="patient-details">
                    <div className="font-medium text-gray-800">{q.name}</div>
                    <div className="appointment-time mt-1">
                      <span className="position-badge">{ordinal(pos)} in line</span>
                      <span className="est-wait-badge">~{estWait} min</span>
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

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type QueueRow = {
  id: number;
  queue_number: string;
  status: string;
  room_id: number | null;
  checkins?: {
    patients?: { first_name: string; last_name: string };
  };
};

export function QueueBoard() {
  const [nowServing, setNowServing] = useState<QueueRow[]>([]);
  const [waiting, setWaiting] = useState<QueueRow[]>([]);

  async function load() {
    const res = await fetch("/api/queue/public");
    if (!res.ok) {
      const fallback = await fetch("/api/queue");
      const data = await fallback.json();
      const items: QueueRow[] = data.queue ?? [];
      setNowServing(items.filter((q) => q.status === "in_progress"));
      setWaiting(items.filter((q) => q.status === "waiting").slice(0, 8));
      return;
    }
    const data = await res.json();
    setNowServing(data.nowServing ?? []);
    setWaiting(data.waiting ?? []);
  }

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel("queue-board")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue" },
        () => load()
      )
      .subscribe();
    const interval = setInterval(load, 10000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white p-8">
      <h1 className="text-4xl font-bold text-center mb-8">CAREQ — Now Serving</h1>
      <div className="grid lg:grid-cols-2 gap-8 max-w-6xl mx-auto">
        <section>
          <h2 className="text-2xl text-green-400 mb-4">Now Serving</h2>
          <div className="space-y-4">
            {nowServing.length === 0 ? (
              <p className="text-slate-400 text-xl">—</p>
            ) : (
              nowServing.map((q) => (
                <div
                  key={q.id}
                  className="bg-green-600 rounded-xl p-6 flex justify-between items-center"
                >
                  <span className="text-5xl font-bold">{q.queue_number}</span>
                  <span className="text-xl">
                    Room {q.room_id ?? "—"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>
        <section>
          <h2 className="text-2xl text-blue-400 mb-4">Waiting</h2>
          <div className="grid grid-cols-2 gap-3">
            {waiting.map((q) => (
              <div
                key={q.id}
                className="bg-slate-800 rounded-lg p-4 text-center text-2xl font-semibold"
              >
                {q.queue_number}
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

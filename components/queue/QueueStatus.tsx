"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type QueueItem = {
  id: number;
  queue_number: string;
  status: string;
  checkins?: {
    reference_number: string;
    patients?: { first_name: string; last_name: string };
  };
};

export function QueueStatus({ refNumber }: { refNumber: string }) {
  const [queue, setQueue] = useState<QueueItem | null>(null);
  const [position, setPosition] = useState<number | null>(null);
  const [waitingCount, setWaitingCount] = useState(0);

  async function load() {
    const res = await fetch(`/api/queue?ref=${encodeURIComponent(refNumber)}`);
    const data = await res.json();
    if (data.queue) setQueue(data.queue);
    setPosition(data.position ?? null);
    setWaitingCount(data.waitingCount ?? 0);
  }

  useEffect(() => {
    load();
    const supabase = createClient();
    const channel = supabase
      .channel("queue-status")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "queue" },
        () => load()
      )
      .subscribe();
    const interval = setInterval(load, 15000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refNumber]);

  if (!queue) {
    return <p className="text-muted-foreground">Loading queue status...</p>;
  }

  const patient = queue.checkins?.patients;

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>{queue.queue_number}</span>
          <Badge
            variant={
              queue.status === "in_progress"
                ? "default"
                : queue.status === "completed"
                  ? "secondary"
                  : "outline"
            }
          >
            {queue.status.replace("_", " ")}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {patient && (
          <p>
            {patient.first_name} {patient.last_name}
          </p>
        )}
        {queue.status === "waiting" && position && (
          <div className="text-center py-4">
            <p className="text-5xl font-bold text-primary">{position}</p>
            <p className="text-muted-foreground">
              position in line ({waitingCount} waiting)
            </p>
          </div>
        )}
        {queue.status === "in_progress" && (
          <p className="text-lg text-green-700 font-medium">
            You are being served now. Please proceed to your room.
          </p>
        )}
        {queue.status === "completed" && (
          <p className="text-muted-foreground">Your visit is complete. Thank you!</p>
        )}
      </CardContent>
    </Card>
  );
}

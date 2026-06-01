"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import type { StaffProfile } from "@/lib/auth";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

type QueueItem = {
  id: number;
  queue_number: string;
  status: string;
  priority: string;
  skip_count: number;
  checkins?: {
    patients?: { first_name: string; last_name: string };
    appointment_types?: { name: string };
  };
};

type Doctor = { id: string; first_name: string; last_name: string };
type Room = { id: number; name: string };

export function DashboardQueue({ staff }: { staff: StaffProfile }) {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [doctorId, setDoctorId] = useState(staff.role === "doctor" ? staff.id : "");
  const [roomId, setRoomId] = useState("");
  const [stats, setStats] = useState({ served: 0, waiting: 0, avg: 10 });
  const [chart, setChart] = useState<{ date: string; served: number }[]>([]);

  const load = useCallback(async () => {
    const [qRes, aRes] = await Promise.all([
      fetch("/api/queue"),
      fetch("/api/queue/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_analytics" }),
      }),
    ]);
    const qData = await qRes.json();
    const aData = await aRes.json();
    setQueue(qData.queue ?? []);
    setStats({
      served: aData.served_today ?? 0,
      waiting: aData.waiting_count ?? 0,
      avg: aData.avg_service_time ?? 10,
    });
    setChart(aData.chart ?? []);
  }, []);

  useEffect(() => {
    load();
    fetch("/api/doctors").then((r) => r.json()).then((d) => setDoctors(d.doctors ?? []));
    fetch("/api/rooms").then((r) => r.json()).then((d) => setRooms(d.rooms ?? []));
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [load]);

  async function action(name: string, queueId?: number) {
    const res = await fetch("/api/queue/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: name,
        queueId,
        doctorId: doctorId || doctors[0]?.id,
        roomNumber: Number(roomId) || rooms[0]?.id,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Action failed");
      return;
    }
    toast.success("Updated");
    load();
  }

  const waiting = queue
    .filter((q) => q.status === "waiting")
    .sort((a, b) => a.skip_count - b.skip_count);
  const inProgress = queue.filter((q) => q.status === "in_progress");
  const next = waiting[0];

  const chartData = {
    labels: chart.map((c) => c.date.slice(5)),
    datasets: [
      {
        label: "Patients Served",
        data: chart.map((c) => c.served),
        backgroundColor: "rgba(37, 99, 235, 0.7)",
      },
    ],
  };

  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Served Today</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.served}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Waiting</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.waiting}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Avg Service (min)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.avg}</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <p className="text-sm mb-1">Doctor</p>
          <Select value={doctorId} onValueChange={(v) => setDoctorId(v ?? "")}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Doctor" />
            </SelectTrigger>
            <SelectContent>
              {doctors.map((d) => (
                <SelectItem key={d.id} value={d.id}>
                  Dr. {d.first_name} {d.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-sm mb-1">Room</p>
          <Select value={roomId} onValueChange={(v) => setRoomId(v ?? "")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Room" />
            </SelectTrigger>
            <SelectContent>
              {rooms.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {next && (
          <Button onClick={() => action("call_next", next.id)}>
            Call Next ({next.queue_number})
          </Button>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Waiting Queue</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {waiting.map((q) => (
              <div
                key={q.id}
                className="flex items-center justify-between border rounded-lg p-3"
              >
                <div>
                  <span className="font-bold text-lg">{q.queue_number}</span>
                  <p className="text-sm text-muted-foreground">
                    {q.checkins?.patients?.first_name}{" "}
                    {q.checkins?.patients?.last_name}
                  </p>
                </div>
                <Badge>{q.priority}</Badge>
              </div>
            ))}
            {waiting.length === 0 && (
              <p className="text-muted-foreground">No patients waiting</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>In Progress</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {inProgress.map((q) => (
              <div
                key={q.id}
                className="flex flex-wrap gap-2 items-center justify-between border rounded-lg p-3"
              >
                <span className="font-bold">{q.queue_number}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => action("skip", q.id)}>
                    Skip
                  </Button>
                  <Button size="sm" onClick={() => action("mark_done", q.id)}>
                    Done
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>7-Day Served</CardTitle>
        </CardHeader>
        <CardContent>
          <Bar data={chartData} options={{ responsive: true }} />
        </CardContent>
      </Card>
    </div>
  );
}

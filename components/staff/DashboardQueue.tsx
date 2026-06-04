"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import {
  UserPlus,
  BarChart3,
  RefreshCw,
  Users,
  Clock,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { StaffProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";
import {
  CareqCard,
  CareqButton,
  ConfirmDialog,
  EmptyState,
  FormLabel,
} from "@/components/careq";
import { cn } from "@/lib/utils";

const Bar = dynamic(
  () =>
    import("react-chartjs-2").then(async (m) => {
      const { Chart, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } =
        await import("chart.js");
      Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);
      return m.Bar;
    }),
  { ssr: false }
);

type QueueWaiting = {
  id: number;
  queueId: number;
  queue_number?: string;
  name: string;
  time: string;
  reason: string;
  position: number;
  est_wait_minutes: number;
  skip_count: number;
};

type QueueInProgress = {
  id: number;
  queueId: number;
  queue_number?: string;
  name: string;
  time: string;
  doctor: string;
  room: string;
};

type QueueCompleted = {
  id: number | string;
  queueId?: number;
  queue_number?: string;
  name: string;
  time: string;
};

type Doctor = { id: string; first_name: string; last_name: string };
type Room = { id: string; name: string };

const CHART_PRIMARY = "rgba(0, 74, 198, 0.75)";

export function DashboardQueue({ staff }: { staff: StaffProfile }) {
  const [waiting, setWaiting] = useState<QueueWaiting[]>([]);
  const [inProgress, setInProgress] = useState<QueueInProgress[]>([]);
  const [completed, setCompleted] = useState<QueueCompleted[]>([]);
  const [noShow, setNoShow] = useState<QueueCompleted[]>([]);
  const [, setAvgServiceTime] = useState(10);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [doctorId, setDoctorId] = useState(staff.role === "doctor" ? staff.id : "");
  const [roomId, setRoomId] = useState("");
  const [stats, setStats] = useState({ served: 0, waiting: 0, avg: 10 });
  const [chartData, setChartData] = useState<{ date: string; served: number; avg_time?: number }[]>([]);
  const [callModalOpen, setCallModalOpen] = useState(false);
  const [recallModal, setRecallModal] = useState<QueueWaiting | null>(null);
  const [recallDoctorId, setRecallDoctorId] = useState("");
  const [recallRoomId, setRecallRoomId] = useState("");
  const [today, setToday] = useState("");

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/queue");
      if (!res.ok) return;
      const data = await res.json();
      if (data.appointment) {
        setWaiting(data.appointment.waiting ?? []);
        setInProgress(data.appointment.inProgress ?? []);
        setCompleted(data.appointment.completed ?? []);
        setNoShow(data.appointment.noShow ?? []);
        setAvgServiceTime(data.appointment.avg_service_time ?? 10);
      }
    } catch {
      // Retry on next poll
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch("/api/queue/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get_report" }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setStats({
        served: data.served_today ?? 0,
        waiting: data.waiting_count ?? 0,
        avg: data.avg_service_time ?? 10,
      });
      setChartData(data.history ?? []);
    } catch {
      // Retry on next poll
    }
  }, []);

  useEffect(() => {
    setToday(
      new Date().toLocaleDateString("en-PH", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    );
    loadQueue();
    loadStats();
    fetch("/api/doctors")
      .then((r) => (r.ok ? r.json() : { doctors: [] }))
      .then((d) => setDoctors(d.doctors ?? []))
      .catch(() => {});
    fetch("/api/rooms")
      .then((r) => (r.ok ? r.json() : { rooms: [] }))
      .then((d) => setRooms(d.rooms ?? []))
      .catch(() => {});

    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () => {
        loadQueue();
        loadStats();
      })
      .subscribe();
    const interval = setInterval(() => {
      loadQueue();
      loadStats();
    }, 5000);
    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [loadQueue, loadStats]);

  async function performAction(
    name: string,
    queueId: number,
    overrideDoctorId?: string,
    overrideRoomId?: string
  ) {
    const useDoctorId = overrideDoctorId ?? doctorId ?? doctors[0]?.id;
    const useRoomId = overrideRoomId ?? roomId ?? rooms[0]?.id;
    const res = await fetch("/api/queue/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: name,
        queueId,
        doctorId: useDoctorId,
        roomNumber: useRoomId,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Action failed");
      return;
    }
    toast.success(
      name === "call_next"
        ? "Patient called!"
        : name === "mark_done"
          ? "Marked as done"
          : name === "mark_no_show"
            ? data.message ?? "Marked as no-show"
            : name === "skip"
              ? "Patient skipped"
              : "Updated"
    );
    loadQueue();
    loadStats();
  }

  async function resetDaily() {
    if (!confirm("Reset today's queue? This will cancel all waiting entries.")) return;
    const res = await fetch("/api/queue/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reset_daily" }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Reset failed");
      return;
    }
    toast.success(`Queue reset. ${data.cancelled} entries cancelled.`);
    loadQueue();
    loadStats();
  }

  const nextWaiting = waiting[0];
  const reversed = [...chartData].reverse();
  const barChartData = {
    labels: reversed.map((c) => c.date.slice(5)),
    datasets: [
      {
        label: "Patients Served",
        data: reversed.map((c) => c.served),
        backgroundColor: CHART_PRIMARY,
        borderRadius: 4,
        yAxisID: "y",
      },
    ],
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-headline-md text-on-surface">Today&apos;s Queue</h2>
          <p className="text-body-sm text-on-surface-variant">{today}</p>
        </div>
        <CareqButton onClick={() => setCallModalOpen(true)} className="gap-2">
          <UserPlus className="h-4 w-4" />
          Call Next Patient
        </CareqButton>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-5 mb-5">
        <QueueColumn
          title="Waiting Room"
          headerClass="bg-primary text-primary-foreground"
          footer={`Total waiting: ${waiting.length} patients`}
          empty={
            waiting.length === 0 ? (
              <EmptyState
                icon={Users}
                title="No patients waiting"
                description="The waiting room is clear. New check-ins will appear here."
                className="border-0 bg-transparent py-8"
              />
            ) : null
          }
        >
          {waiting.map((q) => (
            <li key={q.queueId} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-primary">{q.queue_number ?? q.id}</span>
                    <span className="position-badge"># {q.position}</span>
                    <span className="est-wait-badge">~{q.est_wait_minutes}m</span>
                    {q.skip_count > 0 && (
                      <span className="text-label-sm text-amber-600">
                        (skipped {q.skip_count}×)
                      </span>
                    )}
                  </div>
                  <p className="text-body-sm font-medium text-on-surface mt-0.5">{q.name}</p>
                  {q.reason && (
                    <p className="text-label-sm text-on-surface-variant truncate">{q.reason}</p>
                  )}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setRecallModal(q)}
                  className="shrink-0 text-label-sm"
                >
                  Recall
                </Button>
              </div>
            </li>
          ))}
        </QueueColumn>

        <QueueColumn
          title="In Progress"
          headerClass="bg-amber-500 text-white"
          footer={`Total in progress: ${inProgress.length} patients`}
          empty={
            inProgress.length === 0 ? (
              <p className="px-4 py-6 text-body-sm text-on-surface-variant text-center">
                No patients in progress
              </p>
            ) : null
          }
        >
          {inProgress.map((q) => (
            <li key={q.queueId} className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-bold text-primary">{q.queue_number ?? q.id}</span>
                <span className="text-body-sm font-medium text-on-surface">{q.name}</span>
              </div>
              <p className="text-label-sm text-on-surface-variant mb-2">
                {q.doctor} · {q.room}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => performAction("skip", q.queueId)}
                >
                  Skip
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-amber-500 text-amber-700 hover:bg-amber-50"
                  onClick={() => performAction("mark_no_show", q.queueId)}
                >
                  No Show
                </Button>
                <CareqButton size="sm" onClick={() => performAction("mark_done", q.queueId)}>
                  Mark Done
                </CareqButton>
              </div>
            </li>
          ))}
        </QueueColumn>

        <QueueColumn
          title="Completed"
          headerClass="bg-status-called text-white"
          footer={`Total completed: ${completed.length} patients`}
          listClass="max-h-72 overflow-y-auto"
          empty={
            completed.length === 0 ? (
              <p className="px-4 py-6 text-body-sm text-on-surface-variant text-center">
                No completions yet today
              </p>
            ) : null
          }
        >
          {completed.map((q, i) => (
            <li
              key={q.queueId ?? i}
              className="px-4 py-2 flex items-center justify-between gap-2"
            >
              <span className="font-medium text-on-surface">{q.id}</span>
              <span className="text-body-sm text-on-surface-variant truncate">{q.name}</span>
            </li>
          ))}
        </QueueColumn>

        <QueueColumn
          title="No Show"
          headerClass="bg-amber-600 text-white"
          footer={`No show today: ${noShow.length}`}
          listClass="max-h-48 overflow-y-auto"
          empty={
            noShow.length === 0 ? (
              <p className="px-4 py-6 text-body-sm text-on-surface-variant text-center">
                No no-shows today
              </p>
            ) : null
          }
        >
          {noShow.map((q, i) => (
            <li
              key={q.queueId ?? i}
              className="px-4 py-2 flex items-center justify-between gap-2"
            >
              <span className="font-bold text-primary">{q.queue_number ?? q.id}</span>
              <span className="text-body-sm text-on-surface truncate">{q.name}</span>
            </li>
          ))}
        </QueueColumn>
      </div>

      <CareqCard className="overflow-hidden mb-5">
        <div className="px-4 py-3 bg-foreground flex items-center justify-between gap-3">
          <h6 className="font-semibold text-primary-foreground flex items-center gap-2 m-0 text-body-md">
            <BarChart3 className="h-4 w-4" />
            Today&apos;s Performance
          </h6>
          {staff.role === "admin" && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={resetDaily}
              className="text-label-sm"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reset Daily Queue
            </Button>
          )}
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 text-center mb-4 divide-y sm:divide-y-0 sm:divide-x divide-outline-variant">
            <div className="py-3 sm:py-0">
              <div className="analytics-value">{stats.avg} min</div>
              <div className="analytics-label">Avg Service Time</div>
            </div>
            <div className="py-3 sm:py-0">
              <div className="analytics-value">{stats.served}</div>
              <div className="analytics-label">Served Today</div>
            </div>
            <div className="py-3 sm:py-0">
              <div className="analytics-value">{stats.waiting}</div>
              <div className="analytics-label">Still Waiting</div>
            </div>
          </div>
          <hr className="mb-3 border-outline-variant" />
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-label-sm text-on-surface-variant font-semibold uppercase tracking-wide">
              Patients Served — Last 7 Days
            </span>
            <Button type="button" variant="outline" size="sm" onClick={loadStats}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
          <div className="relative h-[180px]">
            {chartData.length > 0 && (
              <Bar
                data={barChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: "top" as const,
                      labels: { boxWidth: 12, font: { size: 11 } },
                    },
                  },
                  scales: {
                    y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } },
                    x: { ticks: { font: { size: 10 } } },
                  },
                }}
              />
            )}
          </div>
        </div>
      </CareqCard>

      <ConfirmDialog
        open={callModalOpen}
        onOpenChange={setCallModalOpen}
        title="Call Next Patient"
        footer={
          <>
            <Button variant="outline" onClick={() => setCallModalOpen(false)}>
              Cancel
            </Button>
            <CareqButton
              disabled={!doctorId || !roomId || !nextWaiting}
              onClick={() => {
                if (nextWaiting) {
                  performAction("call_next", nextWaiting.queueId);
                  setCallModalOpen(false);
                }
              }}
            >
              Call Patient
            </CareqButton>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <FormLabel>Select Doctor</FormLabel>
            <Select value={doctorId} onValueChange={(v) => setDoctorId(v ?? "")}>
              <SelectTrigger className="w-full h-11">
                <SelectValue placeholder="Select doctor" />
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
            <FormLabel>Select Room</FormLabel>
            <Select value={roomId} onValueChange={(v) => setRoomId(v ?? "")}>
              <SelectTrigger className="w-full h-11">
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {nextWaiting ? (
            <p className="text-body-sm text-on-surface-variant">
              Next patient: <strong className="text-on-surface">{nextWaiting.name}</strong> (
              {nextWaiting.queue_number ?? nextWaiting.id})
            </p>
          ) : (
            <EmptyState
              icon={Clock}
              title="Queue is empty"
              description="No patients are waiting to be called."
              className="py-6"
            />
          )}
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!recallModal}
        onOpenChange={(open) => {
          if (!open) {
            setRecallModal(null);
            setRecallDoctorId("");
            setRecallRoomId("");
          }
        }}
        title="Recall Patient"
        description={
          recallModal
            ? `Recalling ${recallModal.name} (${recallModal.queue_number ?? recallModal.id})`
            : undefined
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setRecallModal(null);
                setRecallDoctorId("");
                setRecallRoomId("");
              }}
            >
              Cancel
            </Button>
            <CareqButton
              className="bg-sky-500 hover:bg-sky-600"
              disabled={!recallDoctorId || !recallRoomId}
              onClick={() => {
                if (recallModal) {
                  performAction("recall", recallModal.queueId, recallDoctorId, recallRoomId);
                  setRecallModal(null);
                  setRecallDoctorId("");
                  setRecallRoomId("");
                }
              }}
            >
              Recall Patient
            </CareqButton>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <FormLabel>Select Doctor</FormLabel>
            <Select value={recallDoctorId} onValueChange={(v) => setRecallDoctorId(v ?? "")}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select doctor" />
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
            <FormLabel>Select Room</FormLabel>
            <Select value={recallRoomId} onValueChange={(v) => setRecallRoomId(v ?? "")}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select room" />
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </ConfirmDialog>
    </div>
  );
}

function QueueColumn({
  title,
  headerClass,
  footer,
  children,
  empty,
  listClass,
}: {
  title: string;
  headerClass: string;
  footer: string;
  children: React.ReactNode;
  empty?: React.ReactNode;
  listClass?: string;
}) {
  return (
    <CareqCard className="overflow-hidden flex flex-col">
      <div className={cn("px-4 py-3", headerClass)}>
        <h5 className="font-semibold m-0 text-body-md">{title}</h5>
      </div>
      <ul className={cn("divide-y divide-outline-variant flex-1", listClass)}>
        {empty || children}
      </ul>
      <div className="px-4 py-2 bg-surface-container-low border-t border-outline-variant">
        <small className="text-on-surface-variant text-label-sm">{footer}</small>
      </div>
    </CareqCard>
  );
}

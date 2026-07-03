"use client";

import { queueApi } from "@/lib/api/client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  RefreshCw,
  Users,
  Clock,
  UserCheck,
  AlertCircle,
  Activity,
  CheckCircle2,
  UserX,
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
  StatCard,
} from "@/components/careq";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { QueueCommandBar } from "@/components/staff/QueueCommandBar";
import { useRealtimePoll } from "@/lib/hooks/useRealtimePoll";
import {
  doctorLabel,
  doctorLabelForValue,
  doctorSelectItems,
  roomLabel,
  roomLabelForValue,
  roomSelectItems,
} from "@/lib/staff-select-labels";

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

type ColumnId = "waiting" | "in_progress" | "completed" | "no_show";

type ColumnConfig = {
  id: ColumnId;
  title: string;
  tabLabel: string;
  headerClass: string;
  headerIcon: LucideIcon;
  listClass?: string;
};

const QUEUE_COLUMNS: ColumnConfig[] = [
  {
    id: "waiting",
    title: "Waiting Room",
    tabLabel: "Waiting",
    headerClass: "bg-primary text-primary-foreground",
    headerIcon: Users,
  },
  {
    id: "in_progress",
    title: "In Progress",
    tabLabel: "In progress",
    headerClass: "bg-status-called text-white",
    headerIcon: Activity,
  },
  {
    id: "completed",
    title: "Completed",
    tabLabel: "Done",
    headerClass: "bg-status-completed text-white",
    headerIcon: CheckCircle2,
    listClass: "max-h-72 overflow-y-auto",
  },
  {
    id: "no_show",
    title: "No Show",
    tabLabel: "No show",
    headerClass: "bg-status-no-show text-white",
    headerIcon: UserX,
    listClass: "max-h-48 overflow-y-auto",
  },
];

export function DashboardQueue({ staff }: { staff: StaffProfile }) {
  const [waiting, setWaiting] = useState<QueueWaiting[]>([]);
  const [inProgress, setInProgress] = useState<QueueInProgress[]>([]);
  const [completed, setCompleted] = useState<QueueCompleted[]>([]);
  const [noShow, setNoShow] = useState<QueueCompleted[]>([]);
  const [, setAvgServiceTime] = useState(10);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [doctorId, setDoctorId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [stats, setStats] = useState({ served: 0, waiting: 0, avg: 10 });
  const [history, setHistory] = useState<{ date: string; served: number }[]>([]);
  const [recallModal, setRecallModal] = useState<QueueWaiting | null>(null);
  const [recallDoctorId, setRecallDoctorId] = useState("");
  const [recallRoomId, setRecallRoomId] = useState("");
  const [today, setToday] = useState("");
  const [queueTab, setQueueTab] = useState<ColumnId>("waiting");
  const queueLoadedRef = useRef(false);
  const statsLoadedRef = useRef(false);

  const doctorItems = useMemo(() => doctorSelectItems(doctors), [doctors]);
  const roomItems = useMemo(() => roomSelectItems(rooms), [rooms]);

  const loadQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/queue");
      if (!res.ok) {
        if (!queueLoadedRef.current) {
          toast.error("Unable to load queue. Please refresh the page.");
        }
        return;
      }
      const data = await res.json();
      if (data.appointment) {
        setWaiting(data.appointment.waiting ?? []);
        setInProgress(data.appointment.inProgress ?? []);
        setCompleted(data.appointment.completed ?? []);
        setNoShow(data.appointment.noShow ?? []);
        setAvgServiceTime(data.appointment.avg_service_time ?? 10);
      }
      queueLoadedRef.current = true;
    } catch {
      if (!queueLoadedRef.current) {
        toast.error("Unable to load queue. Please check your connection.");
      }
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const data = await queueApi.analytics();
      setStats({
        served: data.served_today ?? 0,
        waiting: data.waiting_count ?? 0,
        avg: data.avg_service_time ?? 10,
      });
      setHistory(data.history ?? []);
      statsLoadedRef.current = true;
    } catch {
      if (!statsLoadedRef.current) {
        toast.error("Unable to load queue statistics.");
      }
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    fetch("/api/queue/public", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ auto: true }),
    }).catch(() => {});
    await Promise.all([loadQueue(), loadStats()]);
  }, [loadQueue, loadStats]);

  const subscribeQueue = useMemo(
    () => (onChange: () => void) => {
      const supabase = createClient();
      return supabase
        .channel("dashboard-queue")
        .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, onChange);
    },
    []
  );

  const { isLive } = useRealtimePoll({
    fetchFn: refreshDashboard,
    subscribe: subscribeQueue,
    fallbackIntervalMs: 5000,
  });

  // Second channel: alert staff when a walk-in patient checks in (type_id = 2)
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-walkin-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "checkins", filter: "type_id=eq.2" },
        () => {
          toast.info("New walk-in arrived", {
            description: "A patient just checked in at the front desk.",
            duration: 6000,
          });
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
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
    fetch("/api/doctors")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load doctors");
        return r.json();
      })
      .then((d) => setDoctors(d.doctors ?? []))
      .catch(() => toast.error("Unable to load doctors."));
    fetch("/api/rooms")
      .then((r) => {
        if (!r.ok) throw new Error("Failed to load rooms");
        return r.json();
      })
      .then((d) => setRooms(d.rooms ?? []))
      .catch(() => toast.error("Unable to load rooms."));
  }, []);

  useEffect(() => {
    if (!doctors.length) return;
    if (staff.role === "doctor" && doctors.some((d) => d.id === staff.id)) {
      setDoctorId((prev) => prev || staff.id);
    }
  }, [doctors, staff.id, staff.role]);

  async function performAction(
    name: string,
    queueId: number,
    overrideDoctorId?: string,
    overrideRoomId?: string
  ) {
    const useDoctorId = overrideDoctorId ?? doctorId ?? doctors[0]?.id;
    const useRoomId = overrideRoomId ?? roomId ?? rooms[0]?.id;
    try {
      let data: { success: boolean; message?: string };
      switch (name) {
        case "call_next":
          data = await queueApi.call(queueId, useDoctorId!, useRoomId!);
          break;
        case "skip":
          data = await queueApi.skip(queueId);
          break;
        case "mark_done":
          data = await queueApi.done(queueId);
          break;
        case "mark_no_show":
          data = await queueApi.noShow(queueId);
          break;
        case "recall":
          data = await queueApi.recall(queueId, useDoctorId!, useRoomId!);
          break;
        default:
          throw new Error("Unknown action");
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    }
  }

  async function resetDaily() {
    if (!confirm("Reset today's queue? This will cancel all waiting entries.")) return;
    try {
      const data = await queueApi.resetDaily();
      toast.success(`Queue reset. ${data.cancelled} entries cancelled.`);
      loadQueue();
      loadStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    }
  }

  const nextWaiting = waiting[0];

  function openRecall(q: QueueWaiting) {
    setRecallModal(q);
    setRecallDoctorId(doctorId || doctors[0]?.id || "");
    setRecallRoomId(roomId || rooms[0]?.id || "");
  }

  const columnCounts: Record<ColumnId, number> = {
    waiting: waiting.length,
    in_progress: inProgress.length,
    completed: completed.length,
    no_show: noShow.length,
  };

  function columnFooter(id: ColumnId): string {
    switch (id) {
      case "waiting":
        return `Total waiting: ${waiting.length} patients`;
      case "in_progress":
        return `Total in progress: ${inProgress.length} patients`;
      case "completed":
        return `Total completed: ${completed.length} patients`;
      case "no_show":
        return `No show today: ${noShow.length}`;
    }
  }

  function columnEmpty(id: ColumnId): React.ReactNode {
    switch (id) {
      case "waiting":
        return waiting.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No patients waiting"
            description="Waiting room is clear."
            className="border-0 bg-transparent py-8"
            action={
              <CareqButton asChild variant="outline" size="sm">
                <Link href="/visit" target="_blank" rel="noopener noreferrer">
                  Open check-in
                </Link>
              </CareqButton>
            }
          />
        ) : null;
      case "in_progress":
        return inProgress.length === 0 ? (
          <p className="px-4 py-6 text-body-sm text-on-surface-variant text-center">
            No patients in progress
          </p>
        ) : null;
      case "completed":
        return completed.length === 0 ? (
          <p className="px-4 py-6 text-body-sm text-on-surface-variant text-center">
            No completions yet today
          </p>
        ) : null;
      case "no_show":
        return noShow.length === 0 ? (
          <p className="px-4 py-6 text-body-sm text-on-surface-variant text-center">
            No no-shows today
          </p>
        ) : null;
    }
  }

  function columnChildren(id: ColumnId): React.ReactNode {
    switch (id) {
      case "waiting":
        return waiting.map((q) => (
          <WaitingRow key={q.queueId} q={q} onRecall={() => openRecall(q)} />
        ));
      case "in_progress":
        return inProgress.map((q) => (
          <InProgressRow
            key={q.queueId}
            q={q}
            onSkip={() => performAction("skip", q.queueId)}
            onNoShow={() => performAction("mark_no_show", q.queueId)}
            onDone={() => performAction("mark_done", q.queueId)}
          />
        ));
      case "completed":
        return completed.map((q, i) => (
          <QueueListRow
            key={q.queueId ?? i}
            queueNumber={String(q.queue_number ?? q.id)}
            name={q.name}
          />
        ));
      case "no_show":
        return noShow.map((q, i) => (
          <QueueListRow
            key={q.queueId ?? i}
            queueNumber={String(q.queue_number ?? q.id)}
            name={q.name}
            highlightId
          />
        ));
    }
  }

  function renderQueueColumn(col: ColumnConfig) {
    return (
      <QueueColumn
        key={col.id}
        title={col.title}
        headerClass={col.headerClass}
        headerIcon={col.headerIcon}
        footer={columnFooter(col.id)}
        listClass={col.listClass}
        empty={columnEmpty(col.id)}
      >
        {columnChildren(col.id)}
      </QueueColumn>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <h2 className="text-headline-md text-on-surface">Today&apos;s queue</h2>
        <p className="text-body-sm text-on-surface-variant">{today}</p>
      </div>

      <QueueCommandBar
        className="mb-4"
        doctors={doctors}
        rooms={rooms}
        doctorId={doctorId}
        roomId={roomId}
        onDoctorChange={setDoctorId}
        onRoomChange={setRoomId}
        onCallNext={() => {
          if (nextWaiting) performAction("call_next", nextWaiting.queueId);
        }}
        canCall={Boolean(doctorId && roomId && nextWaiting)}
        isLive={isLive}
      />

      <div className="mb-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <h3 className="text-headline-sm text-on-surface">Today</h3>
          {staff.role === "admin" && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={resetDaily}
              className="cursor-pointer"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Reset queue
            </Button>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Avg service" value={`${stats.avg} min`} icon={Clock} />
          <StatCard label="Served" value={String(stats.served)} icon={UserCheck} />
          <StatCard label="Waiting" value={String(stats.waiting)} icon={Users} />
          <StatCard label="No show" value={String(noShow.length)} icon={AlertCircle} />
        </div>
        {history.length > 0 && (
          <div className="mt-4 rounded-xl border border-outline-variant p-4">
            <h4 className="text-label-sm font-semibold text-on-surface mb-3">
              Patients served (last 7 days)
            </h4>
            <div className="flex items-end gap-2 h-28" aria-label="7-day served chart">
              {history.map((day) => {
                const max = Math.max(...history.map((d) => d.served), 1);
                const height = Math.max(8, Math.round((day.served / max) * 100));
                return (
                  <div key={day.date} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                    <div
                      className="w-full rounded-t bg-primary/80"
                      style={{ height: `${height}%` }}
                      title={`${day.date}: ${day.served}`}
                    />
                    <span className="text-[10px] text-on-surface-variant truncate w-full text-center">
                      {day.date.slice(5)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div
        className="xl:hidden flex gap-1 mb-4 overflow-x-auto pb-1"
        role="tablist"
        aria-label="Queue columns"
      >
        {QUEUE_COLUMNS.map((col) => (
          <button
            key={col.id}
            type="button"
            role="tab"
            aria-selected={queueTab === col.id}
            onClick={() => setQueueTab(col.id)}
            className={cn(
              "shrink-0 min-h-[44px] px-4 rounded-lg text-label-sm font-semibold transition-colors cursor-pointer",
              queueTab === col.id
                ? "bg-primary text-primary-foreground"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            )}
          >
            {col.tabLabel} ({columnCounts[col.id]})
          </button>
        ))}
      </div>

      <div className="hidden xl:grid xl:grid-cols-4 gap-5 mb-5">
        {QUEUE_COLUMNS.map((col) => renderQueueColumn(col))}
      </div>

      <div className="xl:hidden mb-5">
        {QUEUE_COLUMNS.filter((col) => col.id === queueTab).map((col) =>
          renderQueueColumn(col)
        )}
      </div>

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
            <Select
              value={recallDoctorId}
              onValueChange={(v) => setRecallDoctorId(v ?? "")}
              items={doctorItems}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select doctor">
                  {(value) => doctorLabelForValue(doctors, value as string | null)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {doctors.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {doctorLabel(d)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <FormLabel>Select Room</FormLabel>
            <Select
              value={recallRoomId}
              onValueChange={(v) => setRecallRoomId(v ?? "")}
              items={roomItems}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select room">
                  {(value) => roomLabelForValue(rooms, value as string | null)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {rooms.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {roomLabel(r)}
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

function WaitingRow({
  q,
  onRecall,
}: {
  q: QueueWaiting;
  onRecall: () => void;
}) {
  return (
    <li className="px-3 py-2 max-h-[72px]">
      <div className="flex items-center gap-2 min-h-[44px]">
        <span className="font-mono-careq font-bold text-primary text-body-sm shrink-0 w-[4.5rem] truncate">
          {q.queue_number ?? q.id}
        </span>
        <span className="font-semibold text-body-md text-on-surface truncate flex-1 min-w-0">
          {q.name}
        </span>
        <span className="text-body-sm text-on-surface-variant shrink-0">
          ~{q.est_wait_minutes}m
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onRecall}
          className="shrink-0 text-label-sm cursor-pointer"
        >
          Recall
        </Button>
      </div>
    </li>
  );
}

function InProgressRow({
  q,
  onSkip,
  onNoShow,
  onDone,
}: {
  q: QueueInProgress;
  onSkip: () => void;
  onNoShow: () => void;
  onDone: () => void;
}) {
  const location = `${q.doctor} · ${q.room}`;
  return (
    <li className="px-3 py-2">
      <div className="flex flex-wrap items-center gap-2 min-h-[44px]">
        <span className="font-mono-careq font-bold text-primary text-body-sm shrink-0 w-[4.5rem] truncate">
          {q.queue_number ?? q.id}
        </span>
        <span className="font-medium text-body-sm text-on-surface truncate flex-1 min-w-[6rem]">
          {q.name}
        </span>
        <span
          className="text-label-sm text-on-surface-variant truncate max-w-[7rem] hidden md:inline"
          title={location}
        >
          {location}
        </span>
        <div className="flex gap-1.5 shrink-0 ml-auto">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSkip}
            className="cursor-pointer"
          >
            Skip
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-status-no-show text-status-no-show hover:bg-status-no-show/10 cursor-pointer"
            onClick={onNoShow}
          >
            No Show
          </Button>
          <CareqButton size="sm" onClick={onDone} className="cursor-pointer">
            Done
          </CareqButton>
        </div>
      </div>
    </li>
  );
}

function QueueListRow({
  queueNumber,
  name,
  highlightId = false,
}: {
  queueNumber: string;
  name: string;
  highlightId?: boolean;
}) {
  return (
    <li className="px-3 py-2 flex items-center justify-between gap-2 min-h-[44px]">
      <span
        className={cn(
          "font-mono-careq text-body-sm truncate shrink-0",
          highlightId ? "font-bold text-primary" : "text-on-surface-variant"
        )}
      >
        {queueNumber}
      </span>
      <span className="text-body-sm text-on-surface truncate">{name}</span>
    </li>
  );
}

function QueueColumn({
  title,
  headerClass,
  headerIcon: HeaderIcon,
  footer,
  children,
  empty,
  listClass,
}: {
  title: string;
  headerClass: string;
  headerIcon: LucideIcon;
  footer: string;
  children: React.ReactNode;
  empty?: React.ReactNode;
  listClass?: string;
}) {
  return (
    <CareqCard className="overflow-hidden flex flex-col">
      <div className={cn("px-4 py-3 flex items-center gap-2", headerClass)}>
        <HeaderIcon className="h-4 w-4 shrink-0" aria-hidden />
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

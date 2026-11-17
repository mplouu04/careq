"use client";

import { catalogApi, queueApi, queueDataApi, type StaffQueuePayload } from "@/lib/api/client";
import { queryKeys } from "@/lib/query-keys";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
  Stethoscope,
  HeartPulse,
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
  DashboardSkeleton,
  EmptyState,
  FormInput,
  FormLabel,
  StatCard,
} from "@/components/careq";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { QueueCommandBar } from "@/components/staff/QueueCommandBar";
import { QueueHistoryPanel } from "@/components/staff/QueueHistoryPanel";
import { useQueueSubscription } from "@/lib/hooks/useQueueSubscription";
import { useRovingTabs } from "@/lib/hooks/useRovingTabs";
import {
  doctorLabel,
  doctorSelectItems,
  roomLabel,
  roomSelectItems,
} from "@/lib/staff-select-labels";
import {
  DOCTORS_BROADCAST_EVENT,
  DOCTORS_BROADCAST_TOPIC,
} from "@/lib/supabase/broadcast-shared";
import { logRealtimeStatus } from "@/lib/observability-client";

type QueueWaiting = {
  id: number | string;
  queueId: number;
  queue_number?: string;
  name: string;
  time: string;
  visitType: string;
  reason: string;
  position?: number;
  est_wait_minutes?: number;
  skip_count: number;
  assignedDoctorId?: string | null;
  assignedDoctorLabel?: string;
  bp_systolic?: number | null;
  bp_diastolic?: number | null;
  temperature_c?: number | null;
  triage_notes?: string | null;
};

type QueueInProgress = {
  id: number;
  queueId: number;
  queue_number?: string;
  name: string;
  time: string;
  doctor: string;
  room: string;
  skip_count?: number;
  status?: string;
  called_at?: string | null;
  present_at?: string | null;
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

type ColumnId =
  | "waiting"
  | "with_nurse"
  | "ready"
  | "in_progress"
  | "completed"
  | "no_show";

type ColumnConfig = {
  id: ColumnId;
  title: string;
  tabLabel: string;
  headerClass: string;
  headerIcon: LucideIcon;
  listClass?: string;
};

type ParsedQueue = {
  waiting: QueueWaiting[];
  withNurse: QueueWaiting[];
  readyForDoctor: QueueWaiting[];
  inProgress: QueueInProgress[];
  completed: QueueCompleted[];
  noShow: QueueCompleted[];
  avg: number;
  graceMinutes: number;
};

const QUEUE_COLUMNS: ColumnConfig[] = [
  {
    id: "waiting",
    title: "Waiting",
    tabLabel: "Waiting",
    headerClass: "bg-primary text-primary-foreground",
    headerIcon: Users,
  },
  {
    id: "with_nurse",
    title: "With nurse",
    tabLabel: "Nurse",
    headerClass: "bg-teal-700 text-white",
    headerIcon: HeartPulse,
  },
  {
    id: "ready",
    title: "Ready for doctor",
    tabLabel: "Ready",
    headerClass: "bg-amber-700 text-white",
    headerIcon: Stethoscope,
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

function parseStaffQueue(data: StaffQueuePayload): ParsedQueue {
  const appointment = data.appointment;
  return {
    waiting: (appointment?.waiting ?? []) as QueueWaiting[],
    withNurse: (appointment?.withNurse ?? []) as QueueWaiting[],
    readyForDoctor: (appointment?.readyForDoctor ?? []) as QueueWaiting[],
    inProgress: (appointment?.inProgress ?? []) as QueueInProgress[],
    completed: (appointment?.completed ?? []) as QueueCompleted[],
    noShow: (appointment?.noShow ?? []) as QueueCompleted[],
    avg: appointment?.avg_service_time ?? 10,
    graceMinutes: appointment?.no_show_grace_minutes ?? 5,
  };
}

function emptyQueue(): ParsedQueue {
  return {
    waiting: [],
    withNurse: [],
    readyForDoctor: [],
    inProgress: [],
    completed: [],
    noShow: [],
    avg: 10,
    graceMinutes: 5,
  };
}

type QueueAction =
  | { type: "call_next"; queueId: number; doctorId: string; roomId: string; doctorLabel: string; roomLabel: string }
  | { type: "skip"; queueId: number }
  | { type: "mark_done"; queueId: number }
  | { type: "mark_no_show"; queueId: number }
  | { type: "mark_present"; queueId: number }
  | { type: "return_to_queue"; queueId: number }
  | { type: "recall"; queueId: number; doctorId: string; roomId: string; doctorLabel: string; roomLabel: string }
  | { type: "pull_for_nurse"; queueId: number }
  | {
      type: "complete_triage";
      queueId: number;
      assignedDoctorId: string;
      doctorLabel: string;
      bpSystolic?: number | null;
      bpDiastolic?: number | null;
      temperatureC?: number | null;
      triageNotes?: string | null;
    };

function takeLoungePatient(
  next: ParsedQueue,
  queueId: number
): QueueWaiting | null {
  for (const key of ["readyForDoctor", "waiting", "withNurse"] as const) {
    const idx = next[key].findIndex((q) => q.queueId === queueId);
    if (idx !== -1) {
      const [item] = next[key].splice(idx, 1);
      return item;
    }
  }
  return null;
}

function applyOptimistic(prev: ParsedQueue, action: QueueAction): ParsedQueue {
  const next: ParsedQueue = {
    waiting: [...prev.waiting],
    withNurse: [...prev.withNurse],
    readyForDoctor: [...prev.readyForDoctor],
    inProgress: [...prev.inProgress],
    completed: [...prev.completed],
    noShow: [...prev.noShow],
    avg: prev.avg,
    graceMinutes: prev.graceMinutes,
  };

  if (action.type === "pull_for_nurse") {
    const idx = next.waiting.findIndex((q) => q.queueId === action.queueId);
    if (idx === -1) return prev;
    const [item] = next.waiting.splice(idx, 1);
    next.withNurse = [item, ...next.withNurse];
    return next;
  }

  if (action.type === "complete_triage") {
    const idx = next.withNurse.findIndex((q) => q.queueId === action.queueId);
    if (idx === -1) return prev;
    const [item] = next.withNurse.splice(idx, 1);
    next.readyForDoctor = [
      {
        ...item,
        assignedDoctorId: action.assignedDoctorId,
        assignedDoctorLabel: action.doctorLabel,
        bp_systolic: action.bpSystolic ?? null,
        bp_diastolic: action.bpDiastolic ?? null,
        temperature_c: action.temperatureC ?? null,
        triage_notes: action.triageNotes ?? null,
        position: next.readyForDoctor.length + 1,
        est_wait_minutes: next.avg,
      },
      ...next.readyForDoctor,
    ];
    return next;
  }

  if (action.type === "call_next" || action.type === "recall") {
    const item = takeLoungePatient(next, action.queueId);
    if (!item) return prev;
    next.inProgress = [
      {
        id: typeof item.id === "number" ? item.id : 0,
        queueId: item.queueId,
        queue_number: item.queue_number,
        name: item.name,
        time: item.time,
        doctor: action.doctorLabel,
        room: action.roomLabel,
        skip_count: item.skip_count ?? 0,
        status: "called",
        called_at: new Date().toISOString(),
        present_at: null,
      },
      ...next.inProgress,
    ];
    return next;
  }

  if (action.type === "mark_present") {
    const idx = next.inProgress.findIndex((q) => q.queueId === action.queueId);
    if (idx === -1) return prev;
    next.inProgress[idx] = {
      ...next.inProgress[idx],
      status: "in_progress",
      present_at: new Date().toISOString(),
    };
    return next;
  }

  if (action.type === "skip") {
    const idx = next.inProgress.findIndex((q) => q.queueId === action.queueId);
    if (idx === -1) return prev;
    const [item] = next.inProgress.splice(idx, 1);
    next.waiting = [
      ...next.waiting,
      {
        id: item.id,
        queueId: item.queueId,
        queue_number: item.queue_number,
        name: item.name,
        time: item.time,
        visitType: "",
        reason: "",
        position: next.waiting.length + 1,
        est_wait_minutes: next.avg,
        skip_count: (item.skip_count ?? 0) + 1,
      },
    ];
    return next;
  }

  if (action.type === "mark_done") {
    const idx = next.inProgress.findIndex((q) => q.queueId === action.queueId);
    if (idx === -1) return prev;
    const [item] = next.inProgress.splice(idx, 1);
    next.completed = [
      {
        id: item.id,
        queueId: item.queueId,
        queue_number: item.queue_number,
        name: item.name,
        time: item.time,
      },
      ...next.completed,
    ];
    return next;
  }

  if (action.type === "mark_no_show") {
    const fromProgress = next.inProgress.findIndex((q) => q.queueId === action.queueId);
    if (fromProgress !== -1) {
      const [item] = next.inProgress.splice(fromProgress, 1);
      next.noShow = [
        {
          id: item.id,
          queueId: item.queueId,
          queue_number: item.queue_number,
          name: item.name,
          time: item.time,
        },
        ...next.noShow,
      ];
      return next;
    }
    const lounge = takeLoungePatient(next, action.queueId);
    if (!lounge) return prev;
    next.noShow = [
      {
        id: typeof lounge.id === "number" ? lounge.id : 0,
        queueId: lounge.queueId,
        queue_number: lounge.queue_number,
        name: lounge.name,
        time: lounge.time,
      },
      ...next.noShow,
    ];
    return next;
  }

  if (action.type === "return_to_queue") {
    const idx = next.noShow.findIndex((q) => q.queueId === action.queueId);
    if (idx === -1) return prev;
    const [item] = next.noShow.splice(idx, 1);
    next.waiting = [
      ...next.waiting,
      {
        id: typeof item.id === "number" ? item.id : 0,
        queueId: item.queueId!,
        queue_number: item.queue_number,
        name: item.name,
        time: item.time,
        visitType: "",
        reason: "",
        position: next.waiting.length + 1,
        est_wait_minutes: next.avg,
        skip_count: 0,
      },
    ];
    return next;
  }

  return prev;
}

export function DashboardQueue({ staff }: { staff: StaffProfile }) {
  const queryClient = useQueryClient();
  const [doctorId, setDoctorId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [recallModal, setRecallModal] = useState<QueueWaiting | null>(null);
  const [recallDoctorId, setRecallDoctorId] = useState("");
  const [recallRoomId, setRecallRoomId] = useState("");
  const [triageModal, setTriageModal] = useState<QueueWaiting | null>(null);
  const [triageDoctorId, setTriageDoctorId] = useState("");
  const [triageBpSys, setTriageBpSys] = useState("");
  const [triageBpDia, setTriageBpDia] = useState("");
  const [triageTemp, setTriageTemp] = useState("");
  const [triageNotes, setTriageNotes] = useState("");
  const [today, setToday] = useState("");
  const [queueTab, setQueueTab] = useState<ColumnId>("waiting");
  const columnIds = useMemo(
    () => QUEUE_COLUMNS.map((c) => c.id) as ColumnId[],
    []
  );
  const { getTabProps: getQueueTabProps } = useRovingTabs({
    values: columnIds,
    value: queueTab,
    onChange: setQueueTab,
  });
  const lastAutoCompleteRef = useRef(0);
  const AUTO_COMPLETE_MIN_INTERVAL_MS = 120_000;

  const queueQuery = useQuery({
    queryKey: queryKeys.queue.staff(),
    queryFn: async () => parseStaffQueue(await queueDataApi.staff()),
    staleTime: 2_000,
  });

  const analyticsQuery = useQuery({
    queryKey: queryKeys.queue.analytics(),
    queryFn: () => queueApi.analytics(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const doctorsQuery = useQuery({
    queryKey: queryKeys.doctors.list(),
    queryFn: async () => {
      const d = await catalogApi.doctors();
      return (d.doctors ?? []) as Doctor[];
    },
    // Polling fallback in case Realtime silently drops. See plan H3.
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const roomsQuery = useQuery({
    queryKey: queryKeys.rooms.list(),
    queryFn: async () => {
      const d = await catalogApi.rooms();
      return (d.rooms ?? []) as Room[];
    },
    staleTime: 30_000,
  });

  const queue = queueQuery.data ?? emptyQueue();
  const waiting = queue.waiting;
  const withNurse = queue.withNurse;
  const readyForDoctor = queue.readyForDoctor;
  const inProgress = queue.inProgress;
  const completed = queue.completed;
  const noShow = queue.noShow;
  const doctors = doctorsQuery.data ?? [];
  const rooms = roomsQuery.data ?? [];
  const history = analyticsQuery.data?.history ?? [];
  const canTriage =
    staff.role === "nurse" || staff.role === "admin" || staff.role === "receptionist";
  const stats = {
    served: analyticsQuery.data?.served_today ?? completed.length,
    waiting: analyticsQuery.data?.waiting_count ?? waiting.length,
    avg: analyticsQuery.data?.avg_service_time ?? queue.avg,
  };

  const doctorItems = useMemo(() => doctorSelectItems(doctors), [doctors]);
  const roomItems = useMemo(() => roomSelectItems(rooms), [rooms]);

  const maybeAutoComplete = useCallback(() => {
    const now = Date.now();
    if (now - lastAutoCompleteRef.current < AUTO_COMPLETE_MIN_INTERVAL_MS) return;
    lastAutoCompleteRef.current = now;
    void queueDataApi.autoComplete();
  }, []);

  const { isLive } = useQueueSubscription({
    channelName: "dashboard-queue",
    queryKey: queryKeys.queue.staff(),
    fallbackIntervalMs: 5000,
    beforeInvalidate: maybeAutoComplete,
  });

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
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const invalidateDoctors = () =>
      queryClient.invalidateQueries({ queryKey: queryKeys.doctors.list() });

    // Primary path: server-emitted Broadcast on toggle (not RLS-filtered).
    const broadcastChannel = supabase
      .channel(DOCTORS_BROADCAST_TOPIC)
      .on(
        "broadcast",
        { event: DOCTORS_BROADCAST_EVENT },
        () => {
          void invalidateDoctors();
        }
      )
      .subscribe((status) => {
        logRealtimeStatus(DOCTORS_BROADCAST_TOPIC, status);
        if (status === "SUBSCRIBED") {
          void invalidateDoctors();
        }
      });

    // Secondary path: postgres_changes on staff for authenticated staff users.
    const postgresChannel = supabase
      .channel("dashboard-doctors-catalog")
      .on("postgres_changes", { event: "*", schema: "public", table: "staff" }, () => {
        void invalidateDoctors();
      })
      .subscribe((status) => {
        logRealtimeStatus("dashboard-doctors-catalog", status);
      });

    return () => {
      void supabase.removeChannel(broadcastChannel);
      void supabase.removeChannel(postgresChannel);
    };
  }, [queryClient]);

  useEffect(() => {
    if (!doctors.length) return;
    setDoctorId((prev) => (prev && !doctors.some((d) => d.id === prev) ? "" : prev));
    setRecallDoctorId((prev) =>
      prev && !doctors.some((d) => d.id === prev) ? "" : prev
    );
  }, [doctors]);

  useEffect(() => {
    if (!doctors.length) return;
    if (staff.role === "doctor" && doctors.some((d) => d.id === staff.id)) {
      setDoctorId((prev) => prev || staff.id);
    }
  }, [doctors, staff.id, staff.role]);

  const actionMutation = useMutation({
    mutationFn: async (action: QueueAction) => {
      switch (action.type) {
        case "call_next":
          return queueApi.call(action.queueId, action.doctorId, action.roomId);
        case "skip":
          return queueApi.skip(action.queueId);
        case "mark_done":
          return queueApi.done(action.queueId);
        case "mark_no_show":
          return queueApi.noShow(action.queueId);
        case "mark_present":
          return queueApi.present(action.queueId);
        case "return_to_queue":
          return queueApi.returnToQueue(action.queueId);
        case "recall":
          return queueApi.recall(action.queueId, action.doctorId, action.roomId);
        case "pull_for_nurse":
          return queueApi.pullForNurse(action.queueId);
        case "complete_triage":
          return queueApi.completeTriage(action.queueId, {
            assignedDoctorId: action.assignedDoctorId,
            bpSystolic: action.bpSystolic,
            bpDiastolic: action.bpDiastolic,
            temperatureC: action.temperatureC,
            triageNotes: action.triageNotes,
          });
      }
    },
    onMutate: async (action) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.queue.staff() });
      const previous = queryClient.getQueryData<ParsedQueue>(queryKeys.queue.staff());
      if (previous) {
        queryClient.setQueryData(queryKeys.queue.staff(), applyOptimistic(previous, action));
      }
      return { previous };
    },
    onError: (err, _action, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.queue.staff(), context.previous);
      }
      toast.error(err instanceof Error ? err.message : "Action failed");
    },
    onSuccess: (data, action) => {
      toast.success(
        action.type === "call_next"
          ? "Patient called!"
          : action.type === "mark_done"
            ? "Marked as done"
            : action.type === "mark_no_show"
              ? (data as { message?: string }).message ?? "Marked as no-show"
              : action.type === "mark_present"
                ? "Patient marked present"
                : action.type === "return_to_queue"
                  ? "Patient returned to end of queue"
                  : action.type === "skip"
                    ? "Patient skipped"
                    : action.type === "pull_for_nurse"
                      ? "Patient with nurse"
                      : action.type === "complete_triage"
                        ? "Ready for doctor"
                        : "Updated"
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.queue.staff() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.queue.analytics() });
    },
  });

  function performAction(
    name: string,
    queueId: number,
    overrideDoctorId?: string,
    overrideRoomId?: string
  ) {
    const useDoctorId = overrideDoctorId ?? doctorId ?? doctors[0]?.id;
    const useRoomId = overrideRoomId ?? roomId ?? rooms[0]?.id;
    const matchedDoctor = doctors.find((d) => d.id === useDoctorId);
    const matchedRoom = rooms.find((r) => r.id === useRoomId);
    const dLabel = matchedDoctor ? doctorLabel(matchedDoctor) : "Doctor";
    const rLabel = matchedRoom ? roomLabel(matchedRoom) : "Room";

    let action: QueueAction;
    switch (name) {
      case "call_next":
        action = {
          type: "call_next",
          queueId,
          doctorId: useDoctorId!,
          roomId: useRoomId!,
          doctorLabel: dLabel,
          roomLabel: rLabel,
        };
        break;
      case "skip":
        action = { type: "skip", queueId };
        break;
      case "mark_done":
        action = { type: "mark_done", queueId };
        break;
      case "mark_no_show":
        action = { type: "mark_no_show", queueId };
        break;
      case "mark_present":
        action = { type: "mark_present", queueId };
        break;
      case "return_to_queue":
        action = { type: "return_to_queue", queueId };
        break;
      case "recall":
        action = {
          type: "recall",
          queueId,
          doctorId: useDoctorId!,
          roomId: useRoomId!,
          doctorLabel: dLabel,
          roomLabel: rLabel,
        };
        break;
      case "pull_for_nurse":
        action = { type: "pull_for_nurse", queueId };
        break;
      default:
        toast.error("Unknown action");
        return;
    }
    actionMutation.mutate(action);
  }

  function openTriage(q: QueueWaiting) {
    setTriageModal(q);
    setTriageDoctorId(q.assignedDoctorId || doctorId || doctors[0]?.id || "");
    setTriageBpSys(q.bp_systolic != null ? String(q.bp_systolic) : "");
    setTriageBpDia(q.bp_diastolic != null ? String(q.bp_diastolic) : "");
    setTriageTemp(q.temperature_c != null ? String(q.temperature_c) : "");
    setTriageNotes(q.triage_notes ?? "");
  }

  function submitTriage() {
    if (!triageModal || !triageDoctorId) return;
    const matched = doctors.find((d) => d.id === triageDoctorId);
    actionMutation.mutate({
      type: "complete_triage",
      queueId: triageModal.queueId,
      assignedDoctorId: triageDoctorId,
      doctorLabel: matched ? doctorLabel(matched) : "Doctor",
      bpSystolic: triageBpSys ? Number(triageBpSys) : null,
      bpDiastolic: triageBpDia ? Number(triageBpDia) : null,
      temperatureC: triageTemp ? Number(triageTemp) : null,
      triageNotes: triageNotes.trim() || null,
    });
    setTriageModal(null);
  }

  async function resetDaily() {
    if (!confirm("Reset today's queue? This will cancel all waiting entries.")) return;
    try {
      const data = await queueApi.resetDaily();
      toast.success(`Queue reset. ${data.cancelled} entries cancelled.`);
      void queryClient.invalidateQueries({ queryKey: queryKeys.queue.staff() });
      void queryClient.invalidateQueries({ queryKey: queryKeys.queue.analytics() });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    }
  }

  if (queueQuery.isPending && !queueQuery.data) {
    return <DashboardSkeleton />;
  }

  if (queueQuery.isError && !queueQuery.data) {
    return (
      <EmptyState
        icon={AlertCircle}
        title="Unable to load queue"
        description="Please refresh the page or try again."
        action={
          <CareqButton onClick={() => void queueQuery.refetch()}>Retry</CareqButton>
        }
      />
    );
  }

  // Prefer ready-for-doctor (post-triage); desk may Call waiting as override
  const nextToCall = readyForDoctor[0] ?? waiting[0] ?? null;

  function openRecall(q: QueueWaiting) {
    setRecallModal(q);
    setRecallDoctorId(q.assignedDoctorId || doctorId || doctors[0]?.id || "");
    setRecallRoomId(roomId || rooms[0]?.id || "");
  }

  function callPatient(q: QueueWaiting) {
    const preferred = q.assignedDoctorId && doctors.some((d) => d.id === q.assignedDoctorId)
      ? q.assignedDoctorId
      : doctorId;
    if (preferred && preferred !== doctorId) setDoctorId(preferred);
    performAction("call_next", q.queueId, preferred || undefined, roomId || undefined);
  }

  const columnCounts: Record<ColumnId, number> = {
    waiting: waiting.length,
    with_nurse: withNurse.length,
    ready: readyForDoctor.length,
    in_progress: inProgress.length,
    completed: completed.length,
    no_show: noShow.length,
  };

  function columnFooter(id: ColumnId): string {
    switch (id) {
      case "waiting":
        return `Lounge: ${waiting.length}`;
      case "with_nurse":
        return `With nurse: ${withNurse.length}`;
      case "ready":
        return `Ready: ${readyForDoctor.length}`;
      case "in_progress":
        return `In progress: ${inProgress.length}`;
      case "completed":
        return `Completed: ${completed.length}`;
      case "no_show":
        return `No show: ${noShow.length}`;
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
                <Link href="/checkin" target="_blank" rel="noopener noreferrer">
                  Open check-in
                </Link>
              </CareqButton>
            }
          />
        ) : null;
      case "with_nurse":
        return withNurse.length === 0 ? (
          <EmptyState
            icon={HeartPulse}
            title="No one with nurse"
            description="Pull the next patient for vitals."
            className="border-0 bg-transparent py-8"
          />
        ) : null;
      case "ready":
        return readyForDoctor.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No one ready"
            description="Finish nurse triage to fill this list."
            className="border-0 bg-transparent py-8"
          />
        ) : null;
      case "in_progress":
        return inProgress.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="No patients in progress"
            description="Call the next ready patient when a room is free."
            className="border-0 bg-transparent py-8"
          />
        ) : null;
      case "completed":
        return completed.length === 0 ? (
          <EmptyState
            icon={CheckCircle2}
            title="No completions yet"
            description="Finished visits will show up here."
            className="border-0 bg-transparent py-8"
          />
        ) : null;
      case "no_show":
        return noShow.length === 0 ? (
          <EmptyState
            icon={UserX}
            title="No no-shows today"
            description="Missed visits will appear here."
            className="border-0 bg-transparent py-8"
          />
        ) : null;
    }
  }

  function columnChildren(id: ColumnId): React.ReactNode {
    switch (id) {
      case "waiting":
        return waiting.map((q) => (
          <WaitingRow
            key={q.queueId}
            q={q}
            canTriage={canTriage}
            onPullNurse={() => performAction("pull_for_nurse", q.queueId)}
            onCallOverride={() => openRecall(q)}
          />
        ));
      case "with_nurse":
        return withNurse.map((q) => (
          <WithNurseRow
            key={q.queueId}
            q={q}
            canTriage={canTriage}
            onComplete={() => openTriage(q)}
          />
        ));
      case "ready":
        return readyForDoctor.map((q) => (
          <ReadyRow
            key={q.queueId}
            q={q}
            onCall={() => callPatient(q)}
            canCall={Boolean(roomId || rooms[0])}
          />
        ));
      case "in_progress":
        return inProgress.map((q) => (
          <InProgressRow
            key={q.queueId}
            q={q}
            graceMinutes={queue.graceMinutes}
            onPresent={() => performAction("mark_present", q.queueId)}
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
            actionLabel="Return to queue"
            onAction={
              q.queueId != null
                ? () => performAction("return_to_queue", q.queueId!)
                : undefined
            }
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
    <div aria-busy={queueQuery.isFetching}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-headline-md text-on-surface">Today&apos;s queue</h2>
          <p className="text-body-sm text-on-surface-variant">{today}</p>
        </div>
        <QueueHistoryPanel staff={staff} />
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
          if (nextToCall) callPatient(nextToCall);
        }}
        canCall={Boolean(doctorId && roomId && nextToCall)}
        callHint={
          readyForDoctor.length > 0
            ? "Calls next ready (post-nurse) patient"
            : waiting.length > 0
              ? "No ready patients — calls waiting (desk override)"
              : undefined
        }
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
          <StatCard
            label="Avg service (today)"
            value={`${stats.avg} min`}
            subtext="Present → done · today"
            icon={Clock}
            title="Average consult length from when staff taps Present until Done. Used to estimate wait times."
          />
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
            {...getQueueTabProps(col.id)}
            aria-controls={`queue-panel-${col.id}`}
            onClick={() => setQueueTab(col.id)}
            className={cn(
              "shrink-0 min-h-[44px] px-4 rounded-lg text-label-sm font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              queueTab === col.id
                ? "bg-primary text-primary-foreground"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            )}
          >
            {col.tabLabel} ({columnCounts[col.id]})
          </button>
        ))}
      </div>

      <div className="hidden xl:grid xl:grid-cols-3 2xl:grid-cols-6 gap-4 mb-5">
        {QUEUE_COLUMNS.map((col) => renderQueueColumn(col))}
      </div>

      <div
        className="xl:hidden mb-5"
        role="tabpanel"
        id={`queue-panel-${queueTab}`}
        aria-labelledby={`tab-${queueTab}`}
      >
        {QUEUE_COLUMNS.filter((col) => col.id === queueTab).map((col) =>
          renderQueueColumn(col)
        )}
      </div>

      <ConfirmDialog
        open={!!triageModal}
        onOpenChange={(open) => {
          if (!open) setTriageModal(null);
        }}
        title="Nurse triage"
        description={
          triageModal
            ? `Vitals and doctor for ${triageModal.name} (${triageModal.queue_number ?? triageModal.id})`
            : undefined
        }
        footer={
          <>
            <Button variant="outline" onClick={() => setTriageModal(null)}>
              Cancel
            </Button>
            <CareqButton disabled={!triageDoctorId} onClick={submitTriage}>
              Mark ready for doctor
            </CareqButton>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <FormLabel htmlFor="triage-bp-sys">BP systolic</FormLabel>
              <FormInput
                id="triage-bp-sys"
                type="number"
                inputMode="numeric"
                value={triageBpSys}
                onChange={(e) => setTriageBpSys(e.target.value)}
                placeholder="120"
              />
            </div>
            <div>
              <FormLabel htmlFor="triage-bp-dia">BP diastolic</FormLabel>
              <FormInput
                id="triage-bp-dia"
                type="number"
                inputMode="numeric"
                value={triageBpDia}
                onChange={(e) => setTriageBpDia(e.target.value)}
                placeholder="80"
              />
            </div>
          </div>
          <div>
            <FormLabel htmlFor="triage-temp">Temperature (°C)</FormLabel>
            <FormInput
              id="triage-temp"
              type="number"
              inputMode="decimal"
              step="0.1"
              value={triageTemp}
              onChange={(e) => setTriageTemp(e.target.value)}
              placeholder="36.5"
            />
          </div>
          <div>
            <FormLabel htmlFor="triage-notes">Notes</FormLabel>
            <textarea
              id="triage-notes"
              value={triageNotes}
              onChange={(e) => setTriageNotes(e.target.value)}
              rows={3}
              className="flex w-full rounded-lg border border-input bg-background px-3 py-2 text-body-sm resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring min-h-[72px]"
              placeholder="Brief history / chief complaint"
            />
          </div>
          <div>
            <FormLabel>Available doctor</FormLabel>
            <Select
              value={triageDoctorId || null}
              onValueChange={(v) => setTriageDoctorId(v ?? "")}
              items={doctorItems}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select doctor" />
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
        title="Call to doctor"
        description={
          recallModal
            ? `Calling ${recallModal.name} (${recallModal.queue_number ?? recallModal.id}) — desk override skips nurse if still waiting`
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
              Call to room
            </CareqButton>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <FormLabel>Select Doctor</FormLabel>
            <Select
              value={recallDoctorId || null}
              onValueChange={(v) => setRecallDoctorId(v ?? "")}
              items={doctorItems}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select doctor" />
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
              value={recallRoomId || null}
              onValueChange={(v) => setRecallRoomId(v ?? "")}
              items={roomItems}
            >
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Select room" />
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
  canTriage,
  onPullNurse,
  onCallOverride,
}: {
  q: QueueWaiting;
  canTriage: boolean;
  onPullNurse: () => void;
  onCallOverride: () => void;
}) {
  const detail = [q.visitType, q.reason].filter(Boolean).join(" · ");

  return (
    <li className="px-3 py-2 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center gap-2 min-h-[44px]">
        <span className="font-mono-careq font-bold text-primary text-body-sm shrink-0 w-[4.5rem] truncate">
          {q.queue_number ?? q.id}
        </span>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-body-md text-on-surface truncate block">
            {q.name}
          </span>
          {detail ? (
            <span
              className="text-label-sm text-on-surface-variant truncate block"
              title={detail}
            >
              {detail}
            </span>
          ) : null}
        </div>
        {q.est_wait_minutes != null && (
          <span className="text-body-sm text-on-surface-variant shrink-0">
            ~{q.est_wait_minutes}m
          </span>
        )}
        {canTriage && (
          <Button
            type="button"
            size="sm"
            onClick={onPullNurse}
            className="shrink-0 text-label-sm cursor-pointer min-h-[36px]"
          >
            Pull for nurse
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onCallOverride}
          className="shrink-0 text-label-sm cursor-pointer"
          title="Call to doctor without nurse triage (desk override)"
        >
          Call
        </Button>
      </div>
    </li>
  );
}

function WithNurseRow({
  q,
  canTriage,
  onComplete,
}: {
  q: QueueWaiting;
  canTriage: boolean;
  onComplete: () => void;
}) {
  const detail = [q.visitType, q.reason].filter(Boolean).join(" · ");

  return (
    <li className="px-3 py-2 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center gap-2 min-h-[44px]">
        <span className="font-mono-careq font-bold text-primary text-body-sm shrink-0 w-[4.5rem] truncate">
          {q.queue_number ?? q.id}
        </span>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-body-md text-on-surface truncate block">
            {q.name}
          </span>
          {detail ? (
            <span className="text-label-sm text-on-surface-variant truncate block" title={detail}>
              {detail}
            </span>
          ) : null}
        </div>
        {canTriage && (
          <Button
            type="button"
            size="sm"
            onClick={onComplete}
            className="shrink-0 text-label-sm cursor-pointer min-h-[36px]"
          >
            Vitals &amp; assign
          </Button>
        )}
      </div>
    </li>
  );
}

function ReadyRow({
  q,
  onCall,
  canCall,
}: {
  q: QueueWaiting;
  onCall: () => void;
  canCall: boolean;
}) {
  return (
    <li className="px-3 py-2 animate-in fade-in duration-200">
      <div className="flex flex-wrap items-center gap-2 min-h-[44px]">
        <span className="font-mono-careq font-bold text-primary text-body-sm shrink-0 w-[4.5rem] truncate">
          {q.queue_number ?? q.id}
        </span>
        <div className="flex-1 min-w-0">
          <span className="font-semibold text-body-md text-on-surface truncate block">
            {q.name}
          </span>
          {q.assignedDoctorLabel ? (
            <span className="text-label-sm text-on-surface-variant truncate block">
              {q.assignedDoctorLabel}
            </span>
          ) : null}
        </div>
        <Button
          type="button"
          size="sm"
          disabled={!canCall}
          onClick={onCall}
          className="shrink-0 text-label-sm cursor-pointer min-h-[36px]"
        >
          Call to room
        </Button>
      </div>
    </li>
  );
}

function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, "0")}`;
}

function useNoShowCountdown(calledAt: string | null | undefined, graceMinutes: number) {
  const [remainingSec, setRemainingSec] = useState<number | null>(null);

  useEffect(() => {
    if (!calledAt) {
      setRemainingSec(null);
      return;
    }
    const deadline = new Date(calledAt).getTime() + graceMinutes * 60_000;
    const tick = () => {
      setRemainingSec(Math.max(0, Math.round((deadline - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [calledAt, graceMinutes]);

  return remainingSec;
}

function InProgressRow({
  q,
  graceMinutes,
  onPresent,
  onSkip,
  onNoShow,
  onDone,
}: {
  q: QueueInProgress;
  graceMinutes: number;
  onPresent: () => void;
  onSkip: () => void;
  onNoShow: () => void;
  onDone: () => void;
}) {
  const showCountdown = q.status === "called";
  const remainingSec = useNoShowCountdown(showCountdown ? q.called_at : null, graceMinutes);
  const location = `${q.doctor} · ${q.room}`;

  return (
    <li className="px-3 py-2 animate-in fade-in duration-200">
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
        {showCountdown && remainingSec != null && (
          <span
            className="text-label-sm font-semibold text-status-no-show tabular-nums shrink-0"
            aria-live="polite"
          >
            No-show in {formatCountdown(remainingSec)}
          </span>
        )}
        <div className="flex gap-1.5 shrink-0 ml-auto">
          {showCountdown ? (
            <>
              <CareqButton size="sm" onClick={onPresent} className="cursor-pointer">
                Present
              </CareqButton>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-status-no-show text-status-no-show hover:bg-status-no-show/10 cursor-pointer"
                onClick={onNoShow}
              >
                No Show
              </Button>
            </>
          ) : (
            <>
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
            </>
          )}
        </div>
      </div>
    </li>
  );
}

function QueueListRow({
  queueNumber,
  name,
  highlightId = false,
  actionLabel,
  onAction,
}: {
  queueNumber: string;
  name: string;
  highlightId?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <li className="px-3 py-2 flex items-center justify-between gap-2 min-h-[44px] animate-in fade-in duration-200">
      <span
        className={cn(
          "font-mono-careq text-body-sm truncate shrink-0",
          highlightId ? "font-bold text-primary" : "text-on-surface-variant"
        )}
      >
        {queueNumber}
      </span>
      <span className="text-body-sm text-on-surface truncate flex-1">{name}</span>
      {actionLabel && onAction && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onAction}
          className="shrink-0 text-label-sm cursor-pointer"
        >
          {actionLabel}
        </Button>
      )}
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

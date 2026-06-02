"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import { Bar } from "react-chartjs-2";
// ChartJS type is used only for registration

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { StaffProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/client";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend
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
  id: number;
  queueId?: number;
  name: string;
  time: string;
};

type Doctor = { id: string; first_name: string; last_name: string };
type Room = { id: string; name: string };

export function DashboardQueue({ staff }: { staff: StaffProfile }) {
  const [waiting, setWaiting] = useState<QueueWaiting[]>([]);
  const [inProgress, setInProgress] = useState<QueueInProgress[]>([]);
  const [completed, setCompleted] = useState<QueueCompleted[]>([]);
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

  const loadQueue = useCallback(async () => {
    const res = await fetch("/api/queue");
    const data = await res.json();
    if (data.appointment) {
      setWaiting(data.appointment.waiting ?? []);
      setInProgress(data.appointment.inProgress ?? []);
      setCompleted(data.appointment.completed ?? []);
      setAvgServiceTime(data.appointment.avg_service_time ?? 10);
    }
  }, []);

  const loadStats = useCallback(async () => {
    const res = await fetch("/api/queue/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "get_report" }),
    });
    const data = await res.json();
    setStats({
      served: data.served_today ?? 0,
      waiting: data.waiting_count ?? 0,
      avg: data.avg_service_time ?? 10,
    });
    setChartData(data.history ?? []);
  }, []);

  useEffect(() => {
    loadQueue();
    loadStats();
    fetch("/api/doctors")
      .then((r) => r.json())
      .then((d) => setDoctors(d.doctors ?? []));
    fetch("/api/rooms")
      .then((r) => r.json())
      .then((d) => setRooms(d.rooms ?? []));

    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-queue")
      .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, () => {
        loadQueue();
        loadStats();
      })
      .subscribe();
    const interval = setInterval(() => { loadQueue(); loadStats(); }, 5000);
    return () => { supabase.removeChannel(channel); clearInterval(interval); };
  }, [loadQueue, loadStats]);

  async function performAction(name: string, queueId: number, overrideDoctorId?: string, overrideRoomId?: string) {
    const useDoctorId = overrideDoctorId ?? doctorId ?? doctors[0]?.id;
    const useRoomId = overrideRoomId ?? roomId ?? rooms[0]?.id;
    const res = await fetch("/api/queue/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: name, queueId, doctorId: useDoctorId, roomNumber: useRoomId }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? "Action failed"); return; }
    toast.success(name === "call_next" ? "Patient called!" : name === "mark_done" ? "Marked as done" : name === "skip" ? "Patient skipped" : "Updated");
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
    if (!res.ok) { toast.error(data.error ?? "Reset failed"); return; }
    toast.success(`Queue reset. ${data.cancelled} entries cancelled.`);
    loadQueue(); loadStats();
  }

  const nextWaiting = waiting[0];
  const today = new Date().toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const reversed = [...chartData].reverse();
  const barChartData = {
    labels: reversed.map((c) => c.date.slice(5)),
    datasets: [
      {
        label: "Patients Served",
        data: reversed.map((c) => c.served),
        backgroundColor: "rgba(13, 110, 253, 0.75)",
        borderRadius: 4,
        yAxisID: "y",
      },
    ],
  };


  return (
    <div>
      {/* Page header row */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Today&apos;s Queue</h2>
          <p className="text-gray-500 text-sm">{today}</p>
        </div>
        <button
          onClick={() => setCallModalOpen(true)}
          className="inline-flex items-center gap-2 bg-[#0d6efd] hover:bg-[#0b5ed7] text-white font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          Call Next Patient
        </button>
      </div>

      {/* Queue columns */}
      <div className="grid md:grid-cols-3 gap-5 mb-5">
        {/* Waiting Room */}
        <div className="careq-card overflow-hidden">
          <div className="px-4 py-3" style={{ backgroundColor: "#0dcaf0" }}>
            <h5 className="font-semibold text-white m-0">Waiting Room</h5>
          </div>
          <ul className="divide-y divide-gray-100">
            {waiting.map((q) => (
              <li key={q.queueId} className="px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-[#0d6efd]">{q.queue_number ?? q.id}</span>
                      <span className="position-badge"># {q.position}</span>
                      <span className="est-wait-badge">~{q.est_wait_minutes}m</span>
                      {q.skip_count > 0 && (
                        <span className="text-xs text-orange-500">(skipped {q.skip_count}×)</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-800 mt-0.5">{q.name}</p>
                    {q.reason && <p className="text-xs text-gray-500 truncate">{q.reason}</p>}
                  </div>
                  <button
                    onClick={() => setRecallModal(q)}
                    className="ml-2 text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 px-2 py-1 rounded transition-colors flex-shrink-0"
                  >
                    Recall
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {waiting.length === 0 && (
            <div className="px-4 py-3 text-gray-500 text-sm">No patients waiting</div>
          )}
          <div className="px-4 py-2 bg-gray-50 border-t">
            <small className="text-gray-500">Total waiting: <span className="font-medium">{waiting.length}</span> patients</small>
          </div>
        </div>

        {/* In Progress */}
        <div className="careq-card overflow-hidden">
          <div className="px-4 py-3" style={{ backgroundColor: "#ffc107" }}>
            <h5 className="font-semibold text-gray-900 m-0">In Progress</h5>
          </div>
          <ul className="divide-y divide-gray-100">
            {inProgress.map((q) => (
              <li key={q.queueId} className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-bold text-[#0d6efd]">{q.queue_number ?? q.id}</span>
                  <span className="text-sm font-medium text-gray-800">{q.name}</span>
                </div>
                <p className="text-xs text-gray-500 mb-2">{q.doctor} · {q.room}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => performAction("skip", q.queueId)}
                    className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 px-2 py-1 rounded transition-colors"
                  >
                    Skip
                  </button>
                  <button
                    onClick={() => performAction("mark_done", q.queueId)}
                    className="text-xs bg-[#0d6efd] hover:bg-[#0b5ed7] text-white px-2 py-1 rounded transition-colors"
                  >
                    Mark Done
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {inProgress.length === 0 && (
            <div className="px-4 py-3 text-gray-500 text-sm">No patients in progress</div>
          )}
          <div className="px-4 py-2 bg-gray-50 border-t">
            <small className="text-gray-500">Total in progress: <span className="font-medium">{inProgress.length}</span> patients</small>
          </div>
        </div>

        {/* Completed */}
        <div className="careq-card overflow-hidden">
          <div className="px-4 py-3" style={{ backgroundColor: "#198754" }}>
            <h5 className="font-semibold text-white m-0">Completed</h5>
          </div>
          <ul className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {completed.map((q, i) => (
              <li key={q.queueId ?? i} className="px-4 py-2 flex items-center justify-between">
                <span className="font-medium text-gray-800">{q.id}</span>
                <span className="text-sm text-gray-500">{q.name}</span>
              </li>
            ))}
          </ul>
          {completed.length === 0 && (
            <div className="px-4 py-3 text-gray-500 text-sm">No completions yet today</div>
          )}
          <div className="px-4 py-2 bg-gray-50 border-t">
            <small className="text-gray-500">Total completed: <span className="font-medium">{completed.length}</span> patients</small>
          </div>
        </div>
      </div>

      {/* Analytics panel */}
      <div className="careq-card overflow-hidden mb-5">
        <div className="px-4 py-3 bg-gray-900 flex items-center justify-between">
          <h6 className="font-semibold text-white flex items-center gap-2 m-0">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Today&apos;s Performance
          </h6>
          {staff.role === "admin" && (
            <button
              onClick={resetDaily}
              className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded transition-colors flex items-center gap-1"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset Daily Queue
            </button>
          )}
        </div>
        <div className="p-4">
          {/* Stats row */}
          <div className="grid grid-cols-3 text-center mb-4">
            <div className="border-r border-gray-100">
              <div className="analytics-value">{stats.avg} min</div>
              <div className="analytics-label">Avg Service Time</div>
            </div>
            <div className="border-r border-gray-100">
              <div className="analytics-value">{stats.served}</div>
              <div className="analytics-label">Served Today</div>
            </div>
            <div>
              <div className="analytics-value">{stats.waiting}</div>
              <div className="analytics-label">Still Waiting</div>
            </div>
          </div>
          <hr className="mb-3" />
          <div className="flex items-center justify-between mb-2 px-1">
            <small className="text-gray-500 font-semibold">Patients Served — Last 7 Days</small>
            <button
              onClick={loadStats}
              className="text-xs border border-gray-300 text-gray-600 hover:bg-gray-50 px-2 py-1 rounded transition-colors"
            >
              <svg className="w-3 h-3 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
          <div style={{ position: "relative", height: "180px" }}>
            {chartData.length > 0 && (
              <Bar data={barChartData} options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: { position: "top" as const, labels: { boxWidth: 12, font: { size: 11 } } },
                },
                scales: {
                  y: { beginAtZero: true, ticks: { precision: 0, font: { size: 10 } } },
                  x: { ticks: { font: { size: 10 } } },
                },
              }} />
            )}
          </div>
        </div>
      </div>

      {/* Call Next Patient Modal */}
      {callModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-bold text-gray-800">Call Next Patient</h5>
              <button onClick={() => setCallModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Doctor</label>
                <Select value={doctorId} onValueChange={(v) => setDoctorId(v ?? "")}>
                  <SelectTrigger className="w-full">
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Room</label>
                <Select value={roomId} onValueChange={(v) => setRoomId(v ?? "")}>
                  <SelectTrigger className="w-full">
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
                <p className="text-sm text-gray-600">
                  Next patient: <strong>{nextWaiting.name}</strong> ({nextWaiting.queue_number ?? nextWaiting.id})
                </p>
              ) : (
                <p className="text-sm text-gray-400">No patients waiting.</p>
              )}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => setCallModalOpen(false)}
                className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!doctorId || !roomId || !nextWaiting}
                onClick={() => {
                  if (nextWaiting) {
                    performAction("call_next", nextWaiting.queueId);
                    setCallModalOpen(false);
                  }
                }}
                className="flex-1 bg-[#0d6efd] hover:bg-[#0b5ed7] disabled:bg-gray-400 text-white py-2 rounded-lg font-medium transition-colors"
              >
                Call Patient
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recall Modal */}
      {recallModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h5 className="font-bold text-gray-800">Recall Patient</h5>
              <button onClick={() => setRecallModal(null)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <p className="text-sm mb-4">
              Recalling: <strong>{recallModal.name}</strong> ({recallModal.queue_number ?? recallModal.id})
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Doctor</label>
                <Select value={recallDoctorId} onValueChange={(v) => setRecallDoctorId(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Select doctor" /></SelectTrigger>
                  <SelectContent>
                    {doctors.map((d) => (
                      <SelectItem key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Select Room</label>
                <Select value={recallRoomId} onValueChange={(v) => setRecallRoomId(v ?? "")}>
                  <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                  <SelectContent>
                    {rooms.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setRecallModal(null); setRecallDoctorId(""); setRecallRoomId(""); }}
                className="flex-1 border border-gray-300 text-gray-600 hover:bg-gray-50 py-2 rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!recallDoctorId || !recallRoomId}
                onClick={() => {
                  performAction("recall", recallModal.queueId, recallDoctorId, recallRoomId);
                  setRecallModal(null); setRecallDoctorId(""); setRecallRoomId("");
                }}
                className="flex-1 bg-[#0dcaf0] hover:bg-[#31d2f2] text-white py-2 rounded-lg font-medium transition-colors disabled:bg-gray-400"
              >
                Recall Patient
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

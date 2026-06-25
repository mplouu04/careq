"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/careq";
import { ADMIN_TABS } from "@/lib/admin-tokens";
import { CAREQ_DEFAULT_THEME_COLOR } from "@/lib/design-tokens";
import {
  AdminApptStatusBadge,
  AdminButton,
  AdminButtonLink,
  AdminCard,
  AdminCardTitle,
  AdminCheckbox,
  AdminDangerCard,
  AdminFilterPill,
  AdminInput,
  AdminLabel,
  AdminRolePill,
  AdminSelect,
  AdminStaffAvatar,
  AdminStatusBadge,
  AdminTable,
  AdminTableBody,
  AdminTableHead,
  AdminTd,
  AdminTh,
  AdminTr,
} from "@/components/admin/admin-ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getClinicTodayYmd } from "@/lib/datetime";

type StaffRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  is_active: boolean;
};

type ApptType = {
  id: string;
  name: string;
  duration: number;
  description: string | null;
  is_active: boolean;
};

type DisplayScreen = {
  id: string;
  display_name: string;
  location: string;
  show_wait_time: boolean;
  show_priority: boolean;
  theme_color: string;
  is_active: boolean;
};

type Appointment = {
  checkin_id: string;
  reference_number: string;
  appointment_date: string;
  scheduled_time: string;
  status: string;
  patients?: { first_name: string; last_name: string } | null;
  staff?: { first_name: string; last_name: string } | null;
  appointment_types?: { name: string } | null;
};

type RoomRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
};

type DoctorRow = { id: string; first_name: string; last_name: string };

type ScheduleDay = {
  day_of_week: number;
  day_name: string;
  is_active: boolean;
  start_time: string;
  end_time: string;
};

type AdminTab = (typeof ADMIN_TABS)[number]["value"];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  checked_in: "Confirmed",
  cancelled: "Cancelled",
  no_show: "No Show",
  in_progress: "In Progress",
  completed: "Completed",
};

export function AdminPanel() {
  const [activeTab, setActiveTab] = useState<AdminTab>("staff");
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [types, setTypes] = useState<ApptType[]>([]);
  const [settings, setSettings] = useState<DisplayScreen[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [apptFilter, setApptFilter] = useState<
    "upcoming" | "no_show" | "cancelled" | "all"
  >("upcoming");
  const [roomsList, setRoomsList] = useState<RoomRow[]>([]);
  const [adminDoctors, setAdminDoctors] = useState<DoctorRow[]>([]);
  const [scheduleDoctorId, setScheduleDoctorId] = useState("");
  const [schedules, setSchedules] = useState<ScheduleDay[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);

  const [editStaff, setEditStaff] = useState<StaffRow | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editType, setEditType] = useState<ApptType | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [editTypeDuration, setEditTypeDuration] = useState("");
  const [editTypeDesc, setEditTypeDesc] = useState("");

  const load = useCallback(async () => {
    try {
      const [s, t, set, a, roomsRes, doctorsRes] = await Promise.all([
        fetch("/api/admin/staff").then((r) => (r.ok ? r.json() : { staff: [] })),
        fetch("/api/appointment-types").then((r) => (r.ok ? r.json() : { types: [] })),
        fetch("/api/admin/settings").then((r) => (r.ok ? r.json() : { screens: [] })),
        fetch(`/api/appointments?filter=${apptFilter}`).then((r) =>
          r.ok ? r.json() : { appointments: [] }
        ),
        fetch("/api/rooms").then((r) => (r.ok ? r.json() : { rooms: [] })),
        fetch("/api/admin/doctors").then((r) => (r.ok ? r.json() : { doctors: [] })),
      ]);
      setStaffList(s.staff ?? []);
      setTypes(t.types ?? []);
      setSettings(set.screens ?? []);
      setAppointments(a.appointments ?? []);
      setRoomsList(roomsRes.rooms ?? []);
      setAdminDoctors(doctorsRes.doctors ?? []);
    } catch {
      toast.error("Failed to load admin data. Please refresh.");
    } finally {
      setInitialLoading(false);
    }
  }, [apptFilter]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh the appointments list when checkins change while the
  // appointments tab is active. Uses a ref so the effect can read the
  // latest activeTab without re-subscribing every time the tab changes.
  const activeTabRef = useRef(activeTab);
  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("admin-checkins-refresh")
      .on("postgres_changes", { event: "*", schema: "public", table: "checkins" }, () => {
        if (activeTabRef.current === "appointments") {
          load();
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [load]);

  async function createStaff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = String(fd.get("password") ?? "");
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "register",
        email: fd.get("email"),
        password,
        firstName: fd.get("firstName"),
        lastName: fd.get("lastName"),
        role: fd.get("role"),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to create staff");
      return;
    }
    toast.success("Staff account created");
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function updateStaff() {
    if (!editStaff) return;
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        id: editStaff.id,
        firstName: editFirstName,
        lastName: editLastName,
        email: editEmail,
        role: editRole,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Update failed");
      return;
    }
    toast.success("Staff updated");
    setEditStaff(null);
    load();
  }

  async function toggleStaff(id: string) {
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle_active", id }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed");
      return;
    }
    toast.success(`Staff ${data.is_active ? "activated" : "deactivated"}`);
    load();
  }

  async function addApptType(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    const duration = Number(fd.get("duration"));
    if (!name) { toast.error("Name is required"); return; }
    if (!duration || duration < 1) { toast.error("Duration must be ≥1"); return; }
    const res = await fetch("/api/appointment-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "add", name, duration, description: fd.get("description") }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
    toast.success("Appointment type added");
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function toggleType(id: string) {
    await fetch("/api/appointment-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id }),
    });
    toast.success("Toggled");
    load();
  }

  async function saveEditType() {
    if (!editType) return;
    const duration = Number(editTypeDuration);
    if (!editTypeName.trim()) { toast.error("Name required"); return; }
    if (!duration || duration < 1) { toast.error("Duration must be ≥1"); return; }
    const res = await fetch("/api/appointment-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        id: editType.id,
        name: editTypeName,
        duration,
        description: editTypeDesc || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
    toast.success("Updated");
    setEditType(null);
    load();
  }

  async function addDisplay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const display_name = String(fd.get("displayName") ?? "").trim();
    const location = String(fd.get("location") ?? "").trim();
    if (!display_name || !location) {
      toast.error("Display name and location are required");
      return;
    }
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "add",
        display_name,
        location,
        theme_color: fd.get("themeColor") || CAREQ_DEFAULT_THEME_COLOR,
      }),
    });
    toast.success("Display screen added");
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function toggleDisplay(id: string) {
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", id }),
    });
    toast.success("Toggled");
    load();
  }

  async function updateAppt(checkinId: string, action: string) {
    const res = await fetch("/api/appointments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "staff_update", checkinId, status: action }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Update failed");
      return;
    }
    toast.success("Appointment updated");
    load();
  }

  async function addRoom(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const name = String(fd.get("name") ?? "").trim();
    if (!name) {
      toast.error("Room name is required");
      return;
    }
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        description: String(fd.get("description") ?? "") || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to add room");
      return;
    }
    toast.success("Room added");
    (e.target as HTMLFormElement).reset();
    load();
  }

  async function toggleRoom(room: RoomRow) {
    const res = await fetch("/api/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "update",
        id: room.id,
        name: room.name,
        description: room.description,
        is_active: !room.is_active,
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to update room");
      return;
    }
    toast.success(room.is_active ? "Room deactivated" : "Room activated");
    load();
  }

  async function loadDoctorSchedule(doctorId: string) {
    setScheduleDoctorId(doctorId);
    if (!doctorId) {
      setSchedules([]);
      return;
    }
    const res = await fetch(`/api/admin/doctors?doctorId=${doctorId}`);
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to load schedule");
      return;
    }
    setSchedules(data.schedules ?? []);
  }

  async function saveDoctorSchedule() {
    if (!scheduleDoctorId) {
      toast.error("Select a doctor first");
      return;
    }
    const res = await fetch("/api/admin/doctors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "schedule",
        doctorId: scheduleDoctorId,
        schedules: schedules.map((s) => ({
          day_of_week: s.day_of_week,
          is_active: s.is_active,
          start_time: s.start_time,
          end_time: s.end_time,
        })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to save schedule");
      return;
    }
    toast.success("Clinic hours saved");
  }

  async function purgeHistory() {
    if (!confirm("Purge old completed/cancelled queue records? This cannot be undone.")) return;
    const res = await fetch("/api/queue/actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "purge_history" }),
    });
    const data = await res.json();
    if (!res.ok) { toast.error(data.error ?? "Failed"); return; }
    toast.success(`Purged: ${data.queue_deleted} queue rows, ${data.checkins_deleted} orphan checkins`);
  }

  if (initialLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        <Skeleton className="h-64 rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="h-fit rounded-xl border border-[#E5E7EB] bg-white p-2 lg:sticky lg:top-[68px]">
          <nav className="flex flex-row flex-wrap gap-1 lg:flex-col" aria-label="Admin sections">
            {ADMIN_TABS.map((tab) => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setActiveTab(tab.value)}
                className={cn(
                  "rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors",
                  activeTab === tab.value
                    ? "bg-[#EFF6FF] text-[#2563EB]"
                    : "danger" in tab && tab.danger
                      ? "text-[#DC2626] hover:bg-[#FFF5F5]"
                      : "text-[#374151] hover:bg-[#F9FAFB]"
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <div className="flex flex-col gap-4">
          {activeTab === "staff" && (
            <>
              <AdminCard>
                <AdminCardTitle>Staff Accounts</AdminCardTitle>
                <AdminTable>
                  <AdminTableHead>
                    <AdminTh>Name</AdminTh>
                    <AdminTh>Email</AdminTh>
                    <AdminTh>Role</AdminTh>
                    <AdminTh>Active</AdminTh>
                    <AdminTh>Actions</AdminTh>
                  </AdminTableHead>
                  <AdminTableBody>
                    {staffList.map((s) => (
                      <AdminTr key={s.id}>
                        <AdminTd>
                          <div className="flex items-center gap-2.5">
                            <AdminStaffAvatar firstName={s.first_name} lastName={s.last_name} />
                            <span className="font-medium">
                              {s.first_name} {s.last_name}
                            </span>
                          </div>
                        </AdminTd>
                        <AdminTd>{s.email}</AdminTd>
                        <AdminTd>
                          <AdminRolePill>{s.role}</AdminRolePill>
                        </AdminTd>
                        <AdminTd>
                          <AdminStatusBadge active={s.is_active} />
                        </AdminTd>
                        <AdminTd>
                          <div className="flex gap-2">
                            <AdminButton
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditStaff(s);
                                setEditFirstName(s.first_name);
                                setEditLastName(s.last_name);
                                setEditEmail(s.email);
                                setEditRole(s.role);
                              }}
                            >
                              Edit
                            </AdminButton>
                            {s.is_active ? (
                              <AdminButton
                                variant="danger"
                                size="sm"
                                onClick={() => toggleStaff(s.id)}
                              >
                                Deactivate
                              </AdminButton>
                            ) : (
                              <AdminButton
                                variant="outline"
                                size="sm"
                                onClick={() => toggleStaff(s.id)}
                              >
                                Activate
                              </AdminButton>
                            )}
                          </div>
                        </AdminTd>
                      </AdminTr>
                    ))}
                  </AdminTableBody>
                </AdminTable>
              </AdminCard>

              <AdminCard>
                <AdminCardTitle>Add New Staff</AdminCardTitle>
                <form onSubmit={createStaff} className="grid max-w-2xl gap-4 sm:grid-cols-2">
                  <div>
                    <AdminLabel>First Name</AdminLabel>
                    <AdminInput name="firstName" required />
                  </div>
                  <div>
                    <AdminLabel>Last Name</AdminLabel>
                    <AdminInput name="lastName" required />
                  </div>
                  <div>
                    <AdminLabel>Email</AdminLabel>
                    <AdminInput name="email" type="email" required />
                  </div>
                  <div>
                    <AdminLabel>Password (min 8 chars)</AdminLabel>
                    <AdminInput name="password" type="password" minLength={8} required />
                  </div>
                  <div>
                    <AdminLabel>Role</AdminLabel>
                    <AdminSelect name="role" required>
                      <option value="doctor">Doctor</option>
                      <option value="nurse">Nurse</option>
                      <option value="receptionist">Receptionist</option>
                      <option value="admin">Admin</option>
                    </AdminSelect>
                  </div>
                  <div className="flex items-end">
                    <AdminButton type="submit" className="w-full">
                      Create Staff Account
                    </AdminButton>
                  </div>
                </form>
              </AdminCard>
            </>
          )}

          {activeTab === "types" && (
            <>
              <AdminCard>
                <AdminCardTitle>Appointment Types</AdminCardTitle>
                <AdminTable>
                  <AdminTableHead>
                    <AdminTh>Name</AdminTh>
                    <AdminTh>Duration</AdminTh>
                    <AdminTh>Description</AdminTh>
                    <AdminTh>Active</AdminTh>
                    <AdminTh>Actions</AdminTh>
                  </AdminTableHead>
                  <AdminTableBody>
                    {types.map((t) => (
                      <AdminTr key={t.id}>
                        <AdminTd className="font-medium">{t.name}</AdminTd>
                        <AdminTd>{t.duration} min</AdminTd>
                        <AdminTd className="text-[#6B7280]">
                          {t.description ?? "—"}
                        </AdminTd>
                        <AdminTd>
                          <AdminStatusBadge active={t.is_active} />
                        </AdminTd>
                        <AdminTd>
                          <div className="flex gap-2">
                            <AdminButton
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditType(t);
                                setEditTypeName(t.name);
                                setEditTypeDuration(String(t.duration));
                                setEditTypeDesc(t.description ?? "");
                              }}
                            >
                              Edit
                            </AdminButton>
                            {t.is_active ? (
                              <AdminButton
                                variant="danger"
                                size="sm"
                                onClick={() => toggleType(t.id)}
                              >
                                Deactivate
                              </AdminButton>
                            ) : (
                              <AdminButton
                                variant="outline"
                                size="sm"
                                onClick={() => toggleType(t.id)}
                              >
                                Activate
                              </AdminButton>
                            )}
                          </div>
                        </AdminTd>
                      </AdminTr>
                    ))}
                  </AdminTableBody>
                </AdminTable>
              </AdminCard>

              <AdminCard>
                <AdminCardTitle>Add Appointment Type</AdminCardTitle>
                <form onSubmit={addApptType} className="flex flex-wrap items-end gap-4">
                  <div>
                    <AdminLabel>Name</AdminLabel>
                    <AdminInput name="name" required />
                  </div>
                  <div>
                    <AdminLabel>Duration (min)</AdminLabel>
                    <AdminInput name="duration" type="number" min={1} required className="w-28" />
                  </div>
                  <div>
                    <AdminLabel>Description (optional)</AdminLabel>
                    <AdminInput name="description" />
                  </div>
                  <AdminButton type="submit">Add Type</AdminButton>
                </form>
              </AdminCard>
            </>
          )}

          {activeTab === "display" && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {settings.map((s) => (
                  <AdminCard key={s.id}>
                    <div className="mb-3 flex items-center justify-between">
                      <p className="font-semibold text-[#111827]">{s.display_name}</p>
                      <AdminStatusBadge active={s.is_active} />
                    </div>
                    <p className="text-[13px] text-[#6B7280]">{s.location}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className="inline-block h-4 w-4 rounded"
                        style={{ background: s.theme_color }}
                      />
                      <span className="text-xs text-[#9CA3AF]">{s.theme_color}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <AdminButtonLink
                        href={`/queue/${s.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        variant="outline"
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Open Board
                      </AdminButtonLink>
                      {s.is_active ? (
                        <AdminButton
                          variant="danger"
                          size="sm"
                          onClick={() => toggleDisplay(s.id)}
                        >
                          Deactivate
                        </AdminButton>
                      ) : (
                        <AdminButton
                          variant="outline"
                          size="sm"
                          onClick={() => toggleDisplay(s.id)}
                        >
                          Activate
                        </AdminButton>
                      )}
                    </div>
                  </AdminCard>
                ))}
              </div>
              <AdminCard>
                <AdminCardTitle>Add Display Screen</AdminCardTitle>
                <form onSubmit={addDisplay} className="flex flex-wrap items-end gap-4">
                  <div>
                    <AdminLabel>Display Name</AdminLabel>
                    <AdminInput name="displayName" required />
                  </div>
                  <div>
                    <AdminLabel>Location</AdminLabel>
                    <AdminInput name="location" required />
                  </div>
                  <div>
                    <AdminLabel>Theme Color</AdminLabel>
                    <AdminInput
                      name="themeColor"
                      type="color"
                      defaultValue={CAREQ_DEFAULT_THEME_COLOR}
                      className="h-[34px] w-16 p-1"
                    />
                  </div>
                  <AdminButton type="submit">Add Display</AdminButton>
                </form>
              </AdminCard>
            </>
          )}

          {activeTab === "appointments" && (
            <AdminCard>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <AdminCardTitle className="mb-0">Appointments</AdminCardTitle>
                <div className="flex flex-wrap gap-2">
                  {(
                    [
                      ["upcoming", "Upcoming"],
                      ["no_show", "No Show"],
                      ["cancelled", "Cancelled"],
                      ["all", "All"],
                    ] as const
                  ).map(([value, label]) => (
                    <AdminFilterPill
                      key={value}
                      active={apptFilter === value}
                      onClick={() => setApptFilter(value)}
                    >
                      {label}
                    </AdminFilterPill>
                  ))}
                </div>
              </div>
              <AdminTable className="max-h-[min(70vh,560px)] overflow-y-auto">
                <AdminTableHead>
                  <AdminTh>Reference</AdminTh>
                  <AdminTh>Patient</AdminTh>
                  <AdminTh>Doctor</AdminTh>
                  <AdminTh>Date / Time</AdminTh>
                  <AdminTh>Status</AdminTh>
                  <AdminTh>Actions</AdminTh>
                </AdminTableHead>
                <AdminTableBody>
                  {appointments.map((a) => {
                    const p = (Array.isArray(a.patients) ? a.patients[0] : a.patients) as
                      | { first_name: string; last_name: string }
                      | null
                      | undefined;
                    const doc = (Array.isArray(a.staff) ? a.staff[0] : a.staff) as
                      | { first_name: string; last_name: string }
                      | null
                      | undefined;
                    const apptYmd = a.appointment_date?.slice(0, 10) ?? "";
                    const clinicToday = getClinicTodayYmd();
                    const canConfirm = a.status === "pending";
                    const canNoShow =
                      a.status === "checked_in" ||
                      (a.status === "pending" && apptYmd < clinicToday);
                    const canCancel = !["cancelled", "completed", "no_show"].includes(
                      a.status
                    );

                    return (
                      <AdminTr key={a.checkin_id}>
                        <AdminTd className="font-mono text-xs">
                          {a.reference_number}
                        </AdminTd>
                        <AdminTd>
                          {p?.first_name} {p?.last_name}
                        </AdminTd>
                        <AdminTd>
                          Dr. {doc?.first_name} {doc?.last_name}
                        </AdminTd>
                        <AdminTd>
                          {a.appointment_date?.slice(0, 10)} {a.scheduled_time}
                        </AdminTd>
                        <AdminTd>
                          <AdminApptStatusBadge
                            status={a.status}
                            label={STATUS_LABELS[a.status] ?? a.status}
                          />
                        </AdminTd>
                        <AdminTd>
                          <div className="flex flex-wrap gap-1">
                            {canConfirm && (
                              <AdminButton
                                size="sm"
                                onClick={() => updateAppt(a.checkin_id, "confirm")}
                              >
                                Confirm
                              </AdminButton>
                            )}
                            {canNoShow && (
                              <AdminButton
                                variant="outline"
                                size="sm"
                                onClick={() => updateAppt(a.checkin_id, "no_show")}
                              >
                                No-show
                              </AdminButton>
                            )}
                            {canCancel && (
                              <AdminButton
                                variant="danger"
                                size="sm"
                                onClick={() => updateAppt(a.checkin_id, "cancel")}
                              >
                                Cancel
                              </AdminButton>
                            )}
                          </div>
                        </AdminTd>
                      </AdminTr>
                    );
                  })}
                  {appointments.length === 0 && (
                    <AdminTr>
                      <AdminTd colSpan={6} className="py-8 text-center text-[#6B7280]">
                        No appointments in this view
                      </AdminTd>
                    </AdminTr>
                  )}
                </AdminTableBody>
              </AdminTable>
            </AdminCard>
          )}

          {activeTab === "rooms" && (
            <>
              <AdminCard>
                <AdminCardTitle>Exam Rooms</AdminCardTitle>
                <AdminTable>
                  <AdminTableHead>
                    <AdminTh>Name</AdminTh>
                    <AdminTh>Description</AdminTh>
                    <AdminTh>Active</AdminTh>
                    <AdminTh>Actions</AdminTh>
                  </AdminTableHead>
                  <AdminTableBody>
                    {roomsList.map((r) => (
                      <AdminTr key={r.id}>
                        <AdminTd className="font-medium">{r.name}</AdminTd>
                        <AdminTd className="text-[#6B7280]">
                          {r.description ?? "—"}
                        </AdminTd>
                        <AdminTd>
                          <AdminStatusBadge active={r.is_active} />
                        </AdminTd>
                        <AdminTd>
                          {r.is_active ? (
                            <AdminButton
                              variant="danger"
                              size="sm"
                              onClick={() => toggleRoom(r)}
                            >
                              Deactivate
                            </AdminButton>
                          ) : (
                            <AdminButton
                              variant="outline"
                              size="sm"
                              onClick={() => toggleRoom(r)}
                            >
                              Activate
                            </AdminButton>
                          )}
                        </AdminTd>
                      </AdminTr>
                    ))}
                    {roomsList.length === 0 && (
                      <AdminTr>
                        <AdminTd colSpan={4} className="py-8 text-center text-[#6B7280]">
                          No rooms configured
                        </AdminTd>
                      </AdminTr>
                    )}
                  </AdminTableBody>
                </AdminTable>
              </AdminCard>
              <AdminCard>
                <AdminCardTitle>Add Room</AdminCardTitle>
                <form onSubmit={addRoom} className="flex flex-wrap items-end gap-4">
                  <div>
                    <AdminLabel>Name</AdminLabel>
                    <AdminInput name="name" required />
                  </div>
                  <div>
                    <AdminLabel>Description</AdminLabel>
                    <AdminInput name="description" />
                  </div>
                  <AdminButton type="submit">Add Room</AdminButton>
                </form>
              </AdminCard>
            </>
          )}

          {activeTab === "hours" && (
            <AdminCard>
              <AdminCardTitle>Doctor Clinic Hours</AdminCardTitle>
              <div className="mb-4 max-w-sm">
                <AdminLabel>Doctor</AdminLabel>
                <AdminSelect
                  value={scheduleDoctorId}
                  onChange={(e) => loadDoctorSchedule(e.target.value)}
                >
                  <option value="">Select doctor…</option>
                  {adminDoctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.first_name} {d.last_name}
                    </option>
                  ))}
                </AdminSelect>
              </div>
              {schedules.length > 0 && (
                <div className="space-y-2">
                  {schedules.map((s, idx) => (
                    <div
                      key={s.day_of_week}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E5E7EB] p-3"
                    >
                      <label className="flex min-w-[120px] items-center gap-2">
                        <AdminCheckbox
                          checked={s.is_active}
                          onChange={(e) => {
                            const next = [...schedules];
                            next[idx] = { ...s, is_active: e.target.checked };
                            setSchedules(next);
                          }}
                        />
                        <span className="text-sm font-medium text-[#374151]">{s.day_name}</span>
                      </label>
                      <AdminInput
                        type="time"
                        className="w-32"
                        value={s.start_time}
                        disabled={!s.is_active}
                        onChange={(e) => {
                          const next = [...schedules];
                          next[idx] = { ...s, start_time: e.target.value };
                          setSchedules(next);
                        }}
                      />
                      <span className="text-[#6B7280]">to</span>
                      <AdminInput
                        type="time"
                        className="w-32"
                        value={s.end_time}
                        disabled={!s.is_active}
                        onChange={(e) => {
                          const next = [...schedules];
                          next[idx] = { ...s, end_time: e.target.value };
                          setSchedules(next);
                        }}
                      />
                    </div>
                  ))}
                  <AdminButton type="button" onClick={saveDoctorSchedule}>
                    Save Schedule
                  </AdminButton>
                </div>
              )}
            </AdminCard>
          )}

          {activeTab === "data" && (
            <AdminDangerCard>
              <AdminCardTitle className="text-[#DC2626]">Data Cleanup</AdminCardTitle>
              <p className="mb-4 text-[13px] text-[#6B7280]">
                Purge old completed and cancelled queue records from previous days. This
                also removes orphaned check-in records with no linked queue entry.
              </p>
              <AdminButton variant="danger" onClick={purgeHistory}>
                Purge Old Records
              </AdminButton>
            </AdminDangerCard>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={!!editStaff}
        onOpenChange={(open) => !open && setEditStaff(null)}
        title="Edit Staff"
        className="sm:max-w-md"
        footer={
          <>
            <AdminButton variant="outline" onClick={() => setEditStaff(null)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={updateStaff}>Save Changes</AdminButton>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <AdminLabel>First Name</AdminLabel>
            <AdminInput value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
          </div>
          <div>
            <AdminLabel>Last Name</AdminLabel>
            <AdminInput value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <AdminLabel>Email</AdminLabel>
          <AdminInput type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
        </div>
        <div>
          <AdminLabel>Role</AdminLabel>
          <AdminSelect value={editRole} onChange={(e) => setEditRole(e.target.value)}>
            <option value="doctor">Doctor</option>
            <option value="nurse">Nurse</option>
            <option value="receptionist">Receptionist</option>
            <option value="admin">Admin</option>
          </AdminSelect>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!editType}
        onOpenChange={(open) => !open && setEditType(null)}
        title="Edit Appointment Type"
        className="sm:max-w-sm"
        footer={
          <>
            <AdminButton variant="outline" onClick={() => setEditType(null)}>
              Cancel
            </AdminButton>
            <AdminButton onClick={saveEditType}>Save</AdminButton>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <AdminLabel>Name</AdminLabel>
            <AdminInput value={editTypeName} onChange={(e) => setEditTypeName(e.target.value)} />
          </div>
          <div>
            <AdminLabel>Duration (min)</AdminLabel>
            <AdminInput
              type="number"
              min={1}
              value={editTypeDuration}
              onChange={(e) => setEditTypeDuration(e.target.value)}
            />
          </div>
          <div>
            <AdminLabel>Description</AdminLabel>
            <AdminInput value={editTypeDesc} onChange={(e) => setEditTypeDesc(e.target.value)} />
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}

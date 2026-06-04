"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog, StatusBadge, FormSelect, type QueueStatusVariant } from "@/components/careq";
import { CAREQ_DEFAULT_THEME_COLOR } from "@/lib/design-tokens";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
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

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  checked_in: "Confirmed",
  cancelled: "Cancelled",
  no_show: "No Show",
  in_progress: "In Progress",
  completed: "Completed",
};

const APPT_STATUS_VARIANT: Record<string, QueueStatusVariant> = {
  pending: "waiting",
  checked_in: "confirmed",
  cancelled: "cancelled",
  no_show: "no_show",
  in_progress: "called",
  completed: "completed",
};

export function AdminPanel() {
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

  // Edit staff modal
  const [editStaff, setEditStaff] = useState<StaffRow | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("");
  // Edit type modal
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

  // ── Staff ──────────────────────────────────────────────────────────────────

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

  // ── Appointment Types ──────────────────────────────────────────────────────

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

  // ── Display Settings ───────────────────────────────────────────────────────

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

  // ── Appointments ───────────────────────────────────────────────────────────

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
      <div className="space-y-4">
        <Skeleton className="h-10 w-full max-w-lg" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <Tabs defaultValue="staff">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-surface-container-low p-1 rounded-xl border border-outline-variant">
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="types">Appointment Types</TabsTrigger>
          <TabsTrigger value="display">Display Screens</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="hours">Clinic Hours</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        {/* ── Staff tab ─────────────────────────────────────────────────── */}
        <TabsContent value="staff" className="space-y-6">
          <Card className="border-outline-variant bg-surface-container-lowest shadow-sm">
            <CardHeader>
              <CardTitle className="text-headline-sm text-on-surface">Staff Accounts</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffList.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell>
                        {s.first_name} {s.last_name}
                      </TableCell>
                      <TableCell>{s.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{s.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={s.is_active ? "default" : "secondary"}>
                          {s.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditStaff(s);
                              setEditFirstName(s.first_name);
                              setEditLastName(s.last_name);
                              setEditEmail(s.email);
                              setEditRole(s.role);
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant={s.is_active ? "destructive" : "outline"}
                            onClick={() => toggleStaff(s.id)}
                          >
                            {s.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-outline-variant bg-surface-container-lowest shadow-sm">
            <CardHeader>
              <CardTitle>Add New Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={createStaff} className="grid sm:grid-cols-2 gap-4 max-w-2xl">
                <div>
                  <Label>First Name</Label>
                  <Input name="firstName" required />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input name="lastName" required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input name="email" type="email" required />
                </div>
                <div>
                  <Label>Password (min 8 chars)</Label>
                  <Input name="password" type="password" minLength={8} required />
                </div>
                <div>
                  <Label>Role</Label>
                  <FormSelect name="role" required>
                    <option value="doctor">Doctor</option>
                    <option value="nurse">Nurse</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="admin">Admin</option>
                  </FormSelect>
                </div>
                <div className="flex items-end">
                  <Button type="submit" className="w-full">
                    Create Staff Account
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Appointment Types tab ──────────────────────────────────────── */}
        <TabsContent value="types" className="space-y-6">
          <Card className="border-outline-variant bg-surface-container-lowest shadow-sm">
            <CardHeader>
              <CardTitle>Appointment Types</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {types.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell>{t.name}</TableCell>
                      <TableCell>{t.duration} min</TableCell>
                      <TableCell className="text-on-surface-variant">
                        {t.description ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={t.is_active ? "default" : "secondary"}>
                          {t.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditType(t);
                              setEditTypeName(t.name);
                              setEditTypeDuration(String(t.duration));
                              setEditTypeDesc(t.description ?? "");
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant={t.is_active ? "destructive" : "outline"}
                            onClick={() => toggleType(t.id)}
                          >
                            {t.is_active ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-outline-variant bg-surface-container-lowest shadow-sm">
            <CardHeader>
              <CardTitle>Add Appointment Type</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={addApptType} className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label>Name</Label>
                  <Input name="name" required />
                </div>
                <div>
                  <Label>Duration (min)</Label>
                  <Input name="duration" type="number" min={1} required className="w-28" />
                </div>
                <div>
                  <Label>Description (optional)</Label>
                  <Input name="description" />
                </div>
                <Button type="submit">Add Type</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Display Screens tab ────────────────────────────────────────── */}
        <TabsContent value="display" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            {settings.map((s) => (
              <Card key={s.id}>
                <CardContent className="pt-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{s.display_name}</p>
                    <Badge variant={s.is_active ? "default" : "secondary"}>
                      {s.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  <p className="text-sm text-on-surface-variant">{s.location}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="inline-block w-4 h-4 rounded"
                      style={{ background: s.theme_color }}
                    />
                    <span className="text-xs">{s.theme_color}</span>
                  </div>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        href={`/queue/${s.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        Open Board
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleDisplay(s.id)}
                    >
                      {s.is_active ? "Deactivate" : "Activate"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="border-outline-variant bg-surface-container-lowest shadow-sm">
            <CardHeader>
              <CardTitle>Add Display Screen</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={addDisplay} className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label>Display Name</Label>
                  <Input name="displayName" required />
                </div>
                <div>
                  <Label>Location</Label>
                  <Input name="location" required />
                </div>
                <div>
                  <Label>Theme Color</Label>
                  <Input
                    name="themeColor"
                    type="color"
                    defaultValue={CAREQ_DEFAULT_THEME_COLOR}
                    className="w-16 h-9 p-1"
                  />
                </div>
                <Button type="submit">Add Display</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Appointments tab ───────────────────────────────────────────── */}
        <TabsContent value="appointments">
          <Card className="border-outline-variant bg-surface-container-lowest shadow-sm">
            <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>Appointments</CardTitle>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["upcoming", "Upcoming"],
                    ["no_show", "No Show"],
                    ["cancelled", "Cancelled"],
                    ["all", "All"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    size="sm"
                    variant={apptFilter === value ? "default" : "outline"}
                    onClick={() => setApptFilter(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Patient</TableHead>
                    <TableHead>Doctor</TableHead>
                    <TableHead>Date / Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
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
                      <TableRow key={a.checkin_id}>
                        <TableCell className="font-mono text-xs">
                          {a.reference_number}
                        </TableCell>
                        <TableCell>
                          {p?.first_name} {p?.last_name}
                        </TableCell>
                        <TableCell>
                          Dr. {doc?.first_name} {doc?.last_name}
                        </TableCell>
                        <TableCell className="text-sm">
                          {a.appointment_date?.slice(0, 10)} {a.scheduled_time}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={APPT_STATUS_VARIANT[a.status] ?? "pending"}
                            label={STATUS_LABELS[a.status] ?? a.status}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {canConfirm && (
                              <Button
                                size="sm"
                                onClick={() => updateAppt(a.checkin_id, "confirm")}
                              >
                                Confirm
                              </Button>
                            )}
                            {canNoShow && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => updateAppt(a.checkin_id, "no_show")}
                              >
                                No-show
                              </Button>
                            )}
                            {canCancel && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => updateAppt(a.checkin_id, "cancel")}
                              >
                                Cancel
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {appointments.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        className="text-center text-on-surface-variant"
                      >
                        No appointments in this view
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Rooms tab ──────────────────────────────────────────────────── */}
        <TabsContent value="rooms" className="space-y-6">
          <Card className="border-outline-variant bg-surface-container-lowest shadow-sm">
            <CardHeader>
              <CardTitle>Exam Rooms</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {roomsList.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm text-on-surface-variant">
                        {r.description ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={r.is_active ? "default" : "secondary"}>
                          {r.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => toggleRoom(r)}>
                          {r.is_active ? "Deactivate" : "Activate"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {roomsList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-on-surface-variant">
                        No rooms configured
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <Card className="border-outline-variant bg-surface-container-lowest shadow-sm">
            <CardHeader>
              <CardTitle>Add Room</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={addRoom} className="flex flex-wrap gap-4 items-end">
                <div>
                  <Label>Name</Label>
                  <Input name="name" required />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input name="description" />
                </div>
                <Button type="submit">Add Room</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Clinic hours tab ───────────────────────────────────────────── */}
        <TabsContent value="hours" className="space-y-6">
          <Card className="border-outline-variant bg-surface-container-lowest shadow-sm">
            <CardHeader>
              <CardTitle>Doctor Clinic Hours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-sm">
                <Label>Doctor</Label>
                <FormSelect
                  value={scheduleDoctorId}
                  onChange={(e) => loadDoctorSchedule(e.target.value)}
                >
                  <option value="">Select doctor…</option>
                  {adminDoctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      Dr. {d.first_name} {d.last_name}
                    </option>
                  ))}
                </FormSelect>
              </div>
              {schedules.length > 0 && (
                <div className="space-y-2">
                  {schedules.map((s, idx) => (
                    <div
                      key={s.day_of_week}
                      className="flex flex-wrap items-center gap-3 border border-outline-variant rounded-lg p-3"
                    >
                      <label className="flex items-center gap-2 min-w-[120px]">
                        <input
                          type="checkbox"
                          checked={s.is_active}
                          onChange={(e) => {
                            const next = [...schedules];
                            next[idx] = { ...s, is_active: e.target.checked };
                            setSchedules(next);
                          }}
                        />
                        <span className="text-sm font-medium">{s.day_name}</span>
                      </label>
                      <Input
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
                      <span className="text-on-surface-variant">to</span>
                      <Input
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
                  <Button type="button" onClick={saveDoctorSchedule}>
                    Save Schedule
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Data Cleanup tab ───────────────────────────────────────────── */}
        <TabsContent value="data">
          <Card className="border-outline-variant bg-surface-container-lowest shadow-sm">
            <CardHeader>
              <CardTitle>Data Cleanup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-on-surface-variant">
                Purge old completed and cancelled queue records from previous days. This
                also removes orphaned check-in records with no linked queue entry.
              </p>
              <Button variant="destructive" onClick={purgeHistory}>
                Purge Old Records
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={!!editStaff}
        onOpenChange={(open) => !open && setEditStaff(null)}
        title="Edit Staff"
        className="sm:max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditStaff(null)}>
              Cancel
            </Button>
            <Button onClick={updateStaff}>Save Changes</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>First Name</Label>
            <Input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
          </div>
          <div>
            <Label>Last Name</Label>
            <Input value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
        </div>
        <div>
          <Label>Role</Label>
          <FormSelect value={editRole} onChange={(e) => setEditRole(e.target.value)}>
            <option value="doctor">Doctor</option>
            <option value="nurse">Nurse</option>
            <option value="receptionist">Receptionist</option>
            <option value="admin">Admin</option>
          </FormSelect>
        </div>
      </ConfirmDialog>

      <ConfirmDialog
        open={!!editType}
        onOpenChange={(open) => !open && setEditType(null)}
        title="Edit Appointment Type"
        className="sm:max-w-sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setEditType(null)}>
              Cancel
            </Button>
            <Button onClick={saveEditType}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Name</Label>
            <Input value={editTypeName} onChange={(e) => setEditTypeName(e.target.value)} />
          </div>
          <div>
            <Label>Duration (min)</Label>
            <Input
              type="number"
              min={1}
              value={editTypeDuration}
              onChange={(e) => setEditTypeDuration(e.target.value)}
            />
          </div>
          <div>
            <Label>Description</Label>
            <Input value={editTypeDesc} onChange={(e) => setEditTypeDesc(e.target.value)} />
          </div>
        </div>
      </ConfirmDialog>
    </>
  );
}

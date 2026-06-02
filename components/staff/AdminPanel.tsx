"use client";

import { useCallback, useEffect, useState } from "react";
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

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  checked_in: "Confirmed",
  cancelled: "Cancelled",
  no_show: "No Show",
  in_progress: "In Progress",
  completed: "Completed",
};

export function AdminPanel() {
  const [staffList, setStaffList] = useState<StaffRow[]>([]);
  const [types, setTypes] = useState<ApptType[]>([]);
  const [settings, setSettings] = useState<DisplayScreen[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

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
    const [s, t, set, a] = await Promise.all([
      fetch("/api/admin/staff").then((r) => r.json()),
      fetch("/api/appointment-types", {
        headers: { authorization: "Bearer staff" },
      }).then((r) => r.json()),
      fetch("/api/admin/settings").then((r) => r.json()),
      fetch("/api/appointments").then((r) => r.json()),
    ]);
    setStaffList(s.staff ?? []);
    setTypes(t.types ?? []);
    setSettings(set.screens ?? []);
    setAppointments(a.appointments ?? []);
  }, []);

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
        theme_color: fd.get("themeColor") || "#0d6efd",
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

  return (
    <>
      <Tabs defaultValue="staff">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="types">Appointment Types</TabsTrigger>
          <TabsTrigger value="display">Display Screens</TabsTrigger>
          <TabsTrigger value="appointments">Appointments</TabsTrigger>
          <TabsTrigger value="data">Data</TabsTrigger>
        </TabsList>

        {/* ── Staff tab ─────────────────────────────────────────────────── */}
        <TabsContent value="staff" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Staff Accounts</CardTitle>
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

          <Card>
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
                  <select
                    name="role"
                    className="flex h-9 w-full rounded-md border px-3 text-sm bg-background"
                    required
                  >
                    <option value="doctor">Doctor</option>
                    <option value="nurse">Nurse</option>
                    <option value="receptionist">Receptionist</option>
                    <option value="admin">Admin</option>
                  </select>
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
          <Card>
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
                      <TableCell className="text-muted-foreground">
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

          <Card>
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
                  <p className="text-sm text-muted-foreground">{s.location}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <span
                      className="inline-block w-4 h-4 rounded"
                      style={{ background: s.theme_color }}
                    />
                    <span className="text-xs">{s.theme_color}</span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => toggleDisplay(s.id)}
                  >
                    {s.is_active ? "Deactivate" : "Activate"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
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
                  <Input name="themeColor" type="color" defaultValue="#0d6efd" className="w-16 h-9 p-1" />
                </div>
                <Button type="submit">Add Display</Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Appointments tab ───────────────────────────────────────────── */}
        <TabsContent value="appointments">
          <Card>
            <CardHeader>
              <CardTitle>Upcoming Appointments</CardTitle>
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
                    const canConfirm = a.status === "pending";
                    const canNoShow = a.status === "checked_in";
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
                          <Badge
                            variant={
                              a.status === "cancelled" || a.status === "no_show"
                                ? "destructive"
                                : a.status === "checked_in"
                                ? "default"
                                : "secondary"
                            }
                          >
                            {STATUS_LABELS[a.status] ?? a.status}
                          </Badge>
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
                        className="text-center text-muted-foreground"
                      >
                        No upcoming appointments
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Data Cleanup tab ───────────────────────────────────────────── */}
        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle>Data Cleanup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
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

      {/* ── Edit Staff Modal ─────────────────────────────────────────────── */}
      {editStaff && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full space-y-4">
            <h2 className="text-lg font-semibold">Edit Staff</h2>
            <div className="grid grid-cols-2 gap-4">
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
              <select
                value={editRole}
                onChange={(e) => setEditRole(e.target.value)}
                className="flex h-9 w-full rounded-md border px-3 text-sm bg-background"
              >
                <option value="doctor">Doctor</option>
                <option value="nurse">Nurse</option>
                <option value="receptionist">Receptionist</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={updateStaff}>
                Save Changes
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setEditStaff(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Appointment Type Modal ─────────────────────────────────── */}
      {editType && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full space-y-4">
            <h2 className="text-lg font-semibold">Edit Appointment Type</h2>
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
              <Input
                value={editTypeDesc}
                onChange={(e) => setEditTypeDesc(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button className="flex-1" onClick={saveEditType}>
                Save
              </Button>
              <Button variant="outline" className="flex-1" onClick={() => setEditType(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

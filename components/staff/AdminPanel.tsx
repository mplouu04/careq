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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

export function AdminPanel() {
  const [staff, setStaff] = useState<Record<string, unknown>[]>([]);
  const [types, setTypes] = useState<Record<string, unknown>[]>([]);
  const [doctors, setDoctors] = useState<Record<string, unknown>[]>([]);
  const [settings, setSettings] = useState<Record<string, unknown>[]>([]);
  const [appointments, setAppointments] = useState<Record<string, unknown>[]>([]);

  const load = useCallback(async () => {
    const [s, t, d, set, a] = await Promise.all([
      fetch("/api/admin/staff").then((r) => r.json()),
      fetch("/api/appointment-types").then((r) => r.json()),
      fetch("/api/admin/doctors").then((r) => r.json()),
      fetch("/api/admin/settings").then((r) => r.json()),
      fetch("/api/appointments").then((r) => r.json()),
    ]);
    setStaff(s.staff ?? []);
    setTypes(t.types ?? []);
    setDoctors(d.doctors ?? []);
    setSettings(set.settings ?? []);
    setAppointments(a.appointments ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createStaff(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "register",
        email: fd.get("email"),
        password: fd.get("password"),
        firstName: fd.get("firstName"),
        lastName: fd.get("lastName"),
        role: fd.get("role"),
      }),
    });
    const data = await res.json();
    if (!res.ok) toast.error(data.error);
    else {
      toast.success("Staff created");
      load();
    }
  }

  async function saveApptType(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/appointment-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: fd.get("name"),
        duration: Number(fd.get("duration")),
        description: fd.get("description"),
      }),
    });
    toast.success("Saved");
    load();
  }

  async function saveDisplay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        displayName: fd.get("displayName"),
        location: fd.get("location"),
        themeColor: fd.get("themeColor") || "#0d6efd",
      }),
    });
    toast.success("Display added");
    load();
  }

  return (
    <Tabs defaultValue="staff">
      <TabsList className="flex flex-wrap h-auto">
        <TabsTrigger value="staff">Staff</TabsTrigger>
        <TabsTrigger value="types">Appointment Types</TabsTrigger>
        <TabsTrigger value="doctors">Doctors</TabsTrigger>
        <TabsTrigger value="display">Display</TabsTrigger>
        <TabsTrigger value="appointments">Upcoming</TabsTrigger>
      </TabsList>

      <TabsContent value="staff" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Staff List</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => (
                  <TableRow key={String(s.id)}>
                    <TableCell>
                      {String(s.first_name)} {String(s.last_name)}
                    </TableCell>
                    <TableCell>{String(s.email)}</TableCell>
                    <TableCell>{String(s.role)}</TableCell>
                    <TableCell>{s.is_active ? "Yes" : "No"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Add Staff</CardTitle>
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
                <Label>Password</Label>
                <Input name="password" type="password" required />
              </div>
              <div>
                <Label>Role</Label>
                <select name="role" className="flex h-9 w-full rounded-md border px-3 text-sm">
                  <option value="doctor">Doctor</option>
                  <option value="nurse">Nurse</option>
                  <option value="receptionist">Receptionist</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <Button type="submit">Create Staff</Button>
            </form>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="types" className="space-y-4">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Duration</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {types.map((t) => (
              <TableRow key={String(t.id)}>
                <TableCell>{String(t.name)}</TableCell>
                <TableCell>{String(t.duration)} min</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <form onSubmit={saveApptType} className="flex flex-wrap gap-4 items-end">
          <div>
            <Label>Name</Label>
            <Input name="name" required />
          </div>
          <div>
            <Label>Duration (min)</Label>
            <Input name="duration" type="number" required />
          </div>
          <div>
            <Label>Description</Label>
            <Input name="description" />
          </div>
          <Button type="submit">Add Type</Button>
        </form>
      </TabsContent>

      <TabsContent value="doctors">
        <ul className="space-y-2">
          {doctors.map((d) => (
            <li key={String(d.id)} className="border rounded p-3">
              Dr. {String(d.first_name)} {String(d.last_name)} — {String(d.email)}
            </li>
          ))}
        </ul>
        <p className="text-sm text-muted-foreground mt-4">
          Doctor schedules and blocks can be managed via API. Default Mon–Fri 08:00–17:00
          can be seeded in Supabase SQL.
        </p>
      </TabsContent>

      <TabsContent value="display" className="space-y-4">
        {settings.map((s) => (
          <Card key={String(s.id)}>
            <CardContent className="pt-4">
              {String(s.display_name)} — {String(s.location)}
            </CardContent>
          </Card>
        ))}
        <form onSubmit={saveDisplay} className="flex flex-wrap gap-4 items-end">
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
            <Input name="themeColor" type="color" defaultValue="#0d6efd" />
          </div>
          <Button type="submit">Add Display</Button>
        </form>
      </TabsContent>

      <TabsContent value="appointments">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reference</TableHead>
              <TableHead>Patient</TableHead>
              <TableHead>Doctor</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((a) => {
              const p = a.patients as { first_name: string; last_name: string } | null;
              const doc = a.staff as { first_name: string; last_name: string } | null;
              return (
                <TableRow key={String(a.checkin_id)}>
                  <TableCell>{String(a.reference_number)}</TableCell>
                  <TableCell>
                    {p?.first_name} {p?.last_name}
                  </TableCell>
                  <TableCell>
                    Dr. {doc?.first_name} {doc?.last_name}
                  </TableCell>
                  <TableCell>{String(a.status)}</TableCell>
                  <TableCell>
                    <Select
                      onValueChange={async (status) => {
                        await fetch("/api/appointments", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "staff_update",
                            checkinId: a.checkin_id,
                            status,
                          }),
                        });
                        load();
                      }}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Update" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="confirmed">confirmed</SelectItem>
                        <SelectItem value="checked_in">checked_in</SelectItem>
                        <SelectItem value="no_show">no_show</SelectItem>
                        <SelectItem value="cancelled">cancelled</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TabsContent>
    </Tabs>
  );
}

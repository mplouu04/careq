"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Stethoscope } from "lucide-react";
import type { StaffProfile } from "@/lib/auth";
import { adminApi, queueDataApi } from "@/lib/api/client";
import { getClinicTodayYmd } from "@/lib/datetime";
import { CareqCard, EmptyState } from "@/components/careq";
import { queryKeys } from "@/lib/query-keys";

type Appointment = {
  checkin_id: string;
  reference_number: string;
  appointment_date: string;
  scheduled_time: string;
  status: string;
  doctor_id?: string;
  patients?: { first_name: string; last_name: string } | null;
};

type QueueSlice = {
  id: number | string;
  queueId?: number;
  name?: string;
  queue_number?: string;
  status?: string;
  assignedDoctorId?: string | null;
};

export function DoctorDashboard({ staff }: { staff: StaffProfile }) {
  const today = getClinicTodayYmd();
  const doctorId = staff.id;

  const appointmentsQuery = useQuery({
    queryKey: [...queryKeys.admin.all, "doctor-appts", doctorId, today],
    queryFn: async () => {
      const d = await adminApi.appointments("upcoming");
      return (d.appointments ?? []) as Appointment[];
    },
    refetchInterval: 30_000,
  });

  const queueQuery = useQuery({
    queryKey: queryKeys.queue.staff(),
    queryFn: () => queueDataApi.staff(),
    refetchInterval: 15_000,
  });

  const myAppointments = useMemo(() => {
    const rows = appointmentsQuery.data ?? [];
    return rows.filter((a) => {
      const apptDate = a.appointment_date?.slice(0, 10);
      if (apptDate !== today) return false;
      return a.doctor_id === doctorId;
    });
  }, [appointmentsQuery.data, doctorId, today]);

  const myQueue = useMemo(() => {
    const appt = queueQuery.data?.appointment;
    if (!appt) return [];
    const buckets: QueueSlice[] = [
      ...((appt.withNurse as QueueSlice[]) ?? []),
      ...((appt.readyForDoctor as QueueSlice[]) ?? []),
      ...((appt.inProgress as QueueSlice[]) ?? []),
    ];
    return buckets.filter((q) => q.assignedDoctorId === doctorId);
  }, [queueQuery.data, doctorId]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-headline-lg font-bold text-on-surface">
          Dr. {staff.first_name} {staff.last_name}
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Today&apos;s schedule and patients routed to you.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-headline-sm flex items-center gap-2">
          <Calendar className="h-5 w-5 text-primary" aria-hidden />
          Today&apos;s appointments
        </h2>
        {myAppointments.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No appointments today"
            description="Your calendar is clear."
          />
        ) : (
          <ul className="space-y-2">
            {myAppointments.map((a) => {
              const p = Array.isArray(a.patients) ? a.patients[0] : a.patients;
              return (
                <li key={a.checkin_id}>
                  <CareqCard className="p-4 flex justify-between gap-4">
                    <div>
                      <p className="font-mono text-primary text-sm">{a.reference_number}</p>
                      <p className="text-body-sm">
                        {p?.first_name} {p?.last_name}
                      </p>
                      <p className="text-body-sm text-on-surface-variant">
                        {a.scheduled_time?.slice(0, 5)}
                      </p>
                    </div>
                    <span className="text-body-sm capitalize">{a.status.replace("_", " ")}</span>
                  </CareqCard>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-headline-sm flex items-center gap-2">
          <Stethoscope className="h-5 w-5 text-primary" aria-hidden />
          Queue — your patients
        </h2>
        {myQueue.length === 0 ? (
          <EmptyState
            icon={Stethoscope}
            title="No patients assigned"
            description="Check the main queue board."
          />
        ) : (
          <ul className="space-y-2">
            {myQueue.map((q) => (
              <li key={String(q.queueId ?? q.id)}>
                <CareqCard className="p-4 flex justify-between">
                  <span className="font-mono font-semibold">{q.queue_number ?? q.id}</span>
                  <span className="text-body-sm">{q.name ?? "Patient"}</span>
                </CareqCard>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
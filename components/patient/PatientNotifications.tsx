"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Calendar } from "lucide-react";
import { toast } from "sonner";
import { CareqButton, CareqCard, EmptyState, FormInput, FormLabel } from "@/components/careq";
import { patientNotificationsApi } from "@/lib/api/client";
import { cn } from "@/lib/utils";

function formatDobInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseDobInput(value: string): string | null {
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const match = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, dd, mm, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
}

type NotificationRow = {
  id: number;
  title: string;
  body: string;
  category: string;
  reference_number?: string | null;
  is_read: boolean;
  created_at: string;
};

export function PatientNotifications() {
  const queryClient = useQueryClient();
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [active, setActive] = useState<{ phone: string; dob: string } | null>(null);

  const listQuery = useQuery({
    queryKey: ["patient-notifications", active?.phone, active?.dob],
    queryFn: async () => {
      if (!active) return [];
      const data = await patientNotificationsApi.lookup(active.phone, active.dob);
      return (data.notifications ?? []) as NotificationRow[];
    },
    enabled: Boolean(active),
  });

  const markReadMutation = useMutation({
    mutationFn: async (id: number): Promise<void> => {
      if (!active) return;
      await patientNotificationsApi.markRead(active.phone, active.dob, id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["patient-notifications", active?.phone, active?.dob],
      });
    },
  });

  function lookup() {
    const isoDob = parseDobInput(dob);
    if (!phone.trim() || !isoDob) {
      toast.error("Enter phone and date of birth.");
      return;
    }
    setActive({ phone: phone.trim(), dob: isoDob });
  }

  const items = listQuery.data ?? [];

  return (
    <div className="space-y-5 max-w-xl">
      <CareqCard className="p-6 space-y-4">
        <h3 className="text-headline-sm text-on-surface">Your notifications</h3>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FormLabel htmlFor="notif-phone">Phone</FormLabel>
            <FormInput
              id="notif-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>
          <div>
            <FormLabel htmlFor="notif-dob">Date of birth</FormLabel>
            <div className="relative">
              <FormInput
                id="notif-dob"
                value={dob}
                onChange={(e) => setDob(formatDobInput(e.target.value))}
                placeholder="dd/mm/yyyy"
                maxLength={10}
                className="pr-10"
              />
              <Calendar
                className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-on-surface-variant"
                aria-hidden
              />
            </div>
          </div>
        </div>
        <CareqButton onClick={lookup} disabled={listQuery.isFetching} className="w-full">
          <Bell className="h-4 w-4" />
          {listQuery.isFetching ? "Loading..." : "Load notifications"}
        </CareqButton>
      </CareqCard>

      {active && !listQuery.isFetching && items.length === 0 && (
        <EmptyState icon={Bell} title="No notifications" description="Nothing here yet." />
      )}

      {items.length > 0 && (
        <ul className="space-y-3">
          {items.map((n) => (
            <li key={n.id}>
              <CareqCard
                className={cn(
                  "p-4 space-y-1",
                  !n.is_read && "border-primary/40 bg-primary/5"
                )}
              >
                <div className="flex justify-between gap-2 items-start">
                  <div>
                    <p className="font-semibold text-on-surface">{n.title}</p>
                    <p className="text-body-sm text-on-surface-variant">{n.body}</p>
                    {n.reference_number && (
                      <p className="text-body-sm font-mono text-primary mt-1">
                        {n.reference_number}
                      </p>
                    )}
                  </div>
                  {!n.is_read && (
                    <button
                      type="button"
                      className="text-body-sm text-primary font-medium shrink-0"
                      onClick={() => markReadMutation.mutate(n.id)}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </CareqCard>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
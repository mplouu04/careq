"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History } from "lucide-react";
import { api } from "@/lib/api/client";
import { CareqCard, CareqButton } from "@/components/careq";
import type { StaffProfile } from "@/lib/auth";

type HistoryRow = {
  id: number;
  queue_number: string;
  status: string;
  updated_at: string;
  checkins?: {
    reference_number?: string;
    patients?: { first_name: string; last_name: string };
  } | null;
};

const ROLES_WITH_HISTORY = new Set(["admin", "receptionist", "nurse"]);

export function QueueHistoryPanel({ staff }: { staff: StaffProfile }) {
  const [open, setOpen] = useState(false);

  const historyQuery = useQuery({
    queryKey: ["queue", "history", "today"],
    queryFn: async () => {
      const data = await api.get<{ history: HistoryRow[] }>("/api/queue/history");
      return data.history ?? [];
    },
    enabled: open && ROLES_WITH_HISTORY.has(staff.role),
  });

  if (!ROLES_WITH_HISTORY.has(staff.role)) return null;

  return (
    <div className="space-y-2">
      <CareqButton type="button" variant="outline" size="sm" onClick={() => setOpen((v) => !v)}>
        <History className="h-4 w-4" />
        {open ? "Hide today's queue history" : "Today's queue history"}
      </CareqButton>
      {open && (
        <CareqCard className="p-4 max-h-64 overflow-y-auto space-y-2">
          {historyQuery.isFetching && !historyQuery.data ? (
            <p className="text-body-sm text-on-surface-variant">Loading…</p>
          ) : (historyQuery.data ?? []).length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">No completed or closed entries yet.</p>
          ) : (
            <ul className="space-y-2">
              {(historyQuery.data ?? []).map((row) => {
                const c = Array.isArray(row.checkins) ? row.checkins[0] : row.checkins;
                const p = c?.patients
                  ? Array.isArray(c.patients)
                    ? c.patients[0]
                    : c.patients
                  : null;
                return (
                  <li
                    key={row.id}
                    className="flex justify-between gap-2 text-body-sm border-b border-outline-variant/50 pb-2 last:border-0"
                  >
                    <span className="font-mono font-semibold">{row.queue_number}</span>
                    <span className="text-on-surface-variant capitalize">{row.status.replace("_", " ")}</span>
                    <span className="truncate">
                      {p ? `${p.first_name} ${p.last_name}` : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CareqCard>
      )}
    </div>
  );
}
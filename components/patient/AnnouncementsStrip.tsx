"use client";

import { useQuery } from "@tanstack/react-query";
import { Megaphone } from "lucide-react";
import { publicAnnouncementsApi } from "@/lib/api/client";

export function AnnouncementsStrip() {
  const { data } = useQuery({
    queryKey: ["public-announcements"],
    queryFn: () => publicAnnouncementsApi.list(),
    staleTime: 60_000,
  });

  const items = data?.announcements ?? [];
  if (!items.length) return null;

  const latest = items[0];

  return (
    <aside
      className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex gap-3 items-start"
      aria-live="polite"
    >
      <Megaphone className="h-5 w-5 text-primary shrink-0 mt-0.5" aria-hidden />
      <div className="min-w-0">
        <p className="text-label-md font-semibold text-primary">{latest.title}</p>
        <p className="text-body-sm text-on-surface-variant mt-0.5">{latest.body}</p>
      </div>
    </aside>
  );
}
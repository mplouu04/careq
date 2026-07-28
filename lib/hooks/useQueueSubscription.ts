"use client";

import { useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { useRealtimePoll } from "@/lib/hooks/useRealtimePoll";
import { queryKeys } from "@/lib/query-keys";

/**
 * Shared queue-table realtime subscription used by staff dashboard and TV board.
 */
export function useQueueSubscription(options?: {
  channelName?: string;
  queryKey?: readonly unknown[];
  fallbackIntervalMs?: number;
  /** Extra work before invalidating (e.g. dashboard auto-complete) */
  beforeInvalidate?: () => void;
}) {
  const queryClient = useQueryClient();
  const channelName = options?.channelName ?? "queue-live";
  const queryKey = options?.queryKey ?? queryKeys.queue.staff();
  const fallbackIntervalMs = options?.fallbackIntervalMs ?? 15_000;
  const beforeInvalidate = options?.beforeInvalidate;

  const fetchFn = useCallback(async () => {
    beforeInvalidate?.();
    await queryClient.invalidateQueries({ queryKey });
  }, [queryClient, queryKey, beforeInvalidate]);

  const subscribe = useMemo(
    () => (onChange: () => void) => {
      const supabase = createClient();
      return supabase
        .channel(channelName)
        .on("postgres_changes", { event: "*", schema: "public", table: "queue" }, onChange);
    },
    [channelName]
  );

  return useRealtimePoll({
    fetchFn,
    subscribe,
    fallbackIntervalMs,
  });
}

/**
 * Invalidate doctor catalog when staff rows change.
 */
export function useDoctorCatalogSubscription() {
  const queryClient = useQueryClient();

  const fetchFn = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.doctors.list() });
  }, [queryClient]);

  const subscribe = useMemo(
    () => (onChange: () => void) => {
      const supabase = createClient();
      return supabase
        .channel("doctors-catalog-live")
        .on("postgres_changes", { event: "*", schema: "public", table: "staff" }, onChange);
    },
    []
  );

  return useRealtimePoll({
    fetchFn,
    subscribe,
    fallbackIntervalMs: 60_000,
    heartbeatIntervalMs: 0,
  });
}

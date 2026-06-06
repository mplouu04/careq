"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

type UseRealtimePollOptions = {
  fetchFn: () => Promise<void>;
  subscribe: (onChange: () => void) => RealtimeChannel;
  debounceMs?: number;
  fallbackIntervalMs?: number;
  maxBackoffMs?: number;
};

export function useRealtimePoll({
  fetchFn,
  subscribe,
  debounceMs = 300,
  fallbackIntervalMs = 5000,
  maxBackoffMs = 30000,
}: UseRealtimePollOptions) {
  const [isLive, setIsLive] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(fallbackIntervalMs);
  const mountedRef = useRef(true);
  const liveRef = useRef(true);

  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchFn().catch(() => {
        backoffRef.current = Math.min(maxBackoffMs, backoffRef.current * 2);
      });
    }, debounceMs);
  }, [fetchFn, debounceMs, maxBackoffMs]);

  const stopFallbackPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startFallbackPolling = useCallback(() => {
    stopFallbackPolling();
    const tick = () => {
      fetchFn()
        .then(() => {
          backoffRef.current = fallbackIntervalMs;
        })
        .catch(() => {
          backoffRef.current = Math.min(maxBackoffMs, backoffRef.current * 2);
        })
        .finally(() => {
          if (!mountedRef.current || liveRef.current) return;
          pollRef.current = setTimeout(tick, backoffRef.current);
        });
    };
    pollRef.current = setTimeout(tick, backoffRef.current);
  }, [fetchFn, fallbackIntervalMs, maxBackoffMs, stopFallbackPolling]);

  useEffect(() => {
    mountedRef.current = true;
    fetchFn().catch(() => {});

    const channel = subscribe(() => {
      if (!mountedRef.current) return;
      debouncedFetch();
    });

    channel.subscribe((status) => {
      if (!mountedRef.current) return;
      const live = status === "SUBSCRIBED";
      liveRef.current = live;
      setIsLive(live);
      if (live) {
        backoffRef.current = fallbackIntervalMs;
        stopFallbackPolling();
      } else {
        startFallbackPolling();
      }
    });

    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      stopFallbackPolling();
      channel.unsubscribe();
    };
  }, [fetchFn, subscribe, debouncedFetch, startFallbackPolling, stopFallbackPolling, fallbackIntervalMs]);

  return { isLive, refresh: fetchFn };
}

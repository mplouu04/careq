"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

type UseRealtimePollOptions = {
  fetchFn: () => Promise<void>;
  subscribe: (onChange: () => void) => RealtimeChannel;
  debounceMs?: number;
  fallbackIntervalMs?: number;
  maxBackoffMs?: number;
  /** Interval (ms) to keep polling even when the realtime subscription is live.
   *  Acts as a safety net for silently dropped WAL events. Set to 0 to disable. */
  heartbeatIntervalMs?: number;
};

export function useRealtimePoll({
  fetchFn,
  subscribe,
  debounceMs = 300,
  fallbackIntervalMs = 5000,
  maxBackoffMs = 30000,
  heartbeatIntervalMs = 15000,
}: UseRealtimePollOptions) {
  const [isLive, setIsLive] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const backoffRef = useRef(fallbackIntervalMs);
  const mountedRef = useRef(true);
  const liveRef = useRef(false);

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

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    stopHeartbeat();
    if (heartbeatIntervalMs <= 0) return;
    heartbeatRef.current = setInterval(() => {
      if (!mountedRef.current) return;
      fetchFn().catch(() => {});
    }, heartbeatIntervalMs);
  }, [fetchFn, heartbeatIntervalMs, stopHeartbeat]);

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
    // Start polling immediately — the WebSocket is not yet confirmed live.
    // Polling stops only once SUBSCRIBED is received.
    startFallbackPolling();

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
        startHeartbeat();
      } else {
        stopHeartbeat();
        if (!pollRef.current) {
          startFallbackPolling();
        }
      }
    });

    return () => {
      mountedRef.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      stopFallbackPolling();
      stopHeartbeat();
      channel.unsubscribe();
    };
  }, [fetchFn, subscribe, debouncedFetch, startFallbackPolling, stopFallbackPolling, startHeartbeat, stopHeartbeat, fallbackIntervalMs]);

  return { isLive, refresh: fetchFn };
}

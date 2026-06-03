"use client";

import { useState, useEffect, useRef, useCallback } from "react";

interface UseFetchResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
  refresh: () => void;
}

/**
 * Fetches a JSON endpoint and optionally polls it at a fixed interval.
 * On error, uses capped exponential backoff before retrying.
 * On success, clears any previous error automatically.
 *
 * @param url      URL to fetch (relative or absolute)
 * @param interval Polling interval in ms (0 = no polling)
 */
export function useFetch<T = unknown>(
  url: string,
  interval = 0
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const attemptRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: T = await res.json();
      if (!isMountedRef.current) return;
      setData(json);
      setError(null);
      setLoading(false);
      attemptRef.current = 0;

      // Schedule next poll
      if (interval > 0) {
        timerRef.current = setTimeout(load, interval);
      }
    } catch (err) {
      if (!isMountedRef.current) return;
      setError(err instanceof Error ? err.message : "Network error");
      setLoading(false);

      // Exponential backoff capped at 30 s, then resume normal interval
      const backoff = Math.min(30000, Math.pow(2, attemptRef.current) * 1000);
      attemptRef.current += 1;
      timerRef.current = setTimeout(load, backoff);
    }
  }, [url, interval]);

  const refresh = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    attemptRef.current = 0;
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    isMountedRef.current = true;
    load();
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [load]);

  return { data, error, loading, refresh };
}

"use client";

import { useCallback, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

export type WebPushState = "idle" | "unsupported" | "subscribing" | "subscribed" | "denied" | "error";

export function useWebPush(queueNumber: string) {
  const [state, setState] = useState<WebPushState>(() => {
    if (typeof window === "undefined") return "idle";
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      return "unsupported";
    }
    if (Notification.permission === "denied") return "denied";
    return "idle";
  });
  const [error, setError] = useState<string | null>(null);

  const subscribe = useCallback(async () => {
    if (!queueNumber) {
      setError("Missing queue number");
      setState("error");
      return false;
    }

    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) {
      setError("Push notifications are not configured");
      setState("error");
      return false;
    }

    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return false;
    }

    setState("subscribing");
    setError(null);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return false;
      }

      const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      await navigator.serviceWorker.ready;

      let subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
        });
      }

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Invalid push subscription");
      }

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queueNumber,
          subscription: {
            endpoint: json.endpoint,
            keys: {
              p256dh: json.keys.p256dh,
              auth: json.keys.auth,
            },
          },
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to save subscription");
      }

      setState("subscribed");
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Subscription failed");
      setState("error");
      return false;
    }
  }, [queueNumber]);

  return { state, error, subscribe };
}

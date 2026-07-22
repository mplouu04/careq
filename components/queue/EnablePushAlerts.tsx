"use client";

import { CareqButton } from "@/components/careq";
import { useWebPush } from "@/lib/hooks/useWebPush";

type EnablePushAlertsProps = {
  queueNumber: string;
  className?: string;
};

/**
 * Opt-in control for Web Push turn notifications.
 * Shown after check-in and on the status page as a fallback.
 */
export function EnablePushAlerts({ queueNumber, className }: EnablePushAlertsProps) {
  const { state, error, subscribe } = useWebPush(queueNumber);

  // Hide control when VAPID is not configured (graceful degradation)
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return null;
  }

  if (state === "unsupported") {
    return (
      <p className="text-label-sm text-on-surface-variant">
        Push notifications are not supported in this browser.
      </p>
    );
  }

  if (state === "subscribed") {
    return (
      <p className="text-label-sm text-green-700">
        Turn notifications enabled — we&apos;ll alert you when you&apos;re called.
      </p>
    );
  }

  if (state === "denied") {
    return (
      <p className="text-label-sm text-on-surface-variant">
        Notifications blocked. Enable them in your browser settings to get turn alerts.
      </p>
    );
  }

  return (
    <div className={className}>
      <CareqButton
        type="button"
        variant="outline"
        size="sm"
        className="cursor-pointer mb-1"
        disabled={state === "subscribing"}
        onClick={() => void subscribe()}
      >
        {state === "subscribing" ? "Enabling…" : "Enable turn notifications"}
      </CareqButton>
      <p className="text-label-sm text-on-surface-variant">
        On iPhone, tap Share → Add to Home Screen for background alerts.
      </p>
      {state === "error" && error && (
        <p className="text-label-sm text-destructive mt-1">{error}</p>
      )}
    </div>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { CareqButton } from "@/components/careq";
import { cn } from "@/lib/utils";

type QueueTrackFormProps = {
  idPrefix?: string;
  className?: string;
  compact?: boolean;
};

export function QueueTrackForm({
  idPrefix = "queue-track",
  className,
  compact = false,
}: QueueTrackFormProps) {
  const router = useRouter();
  const [queueRef, setQueueRef] = useState("");

  function trackQueue(e: React.FormEvent) {
    e.preventDefault();
    const ref = queueRef.trim();
    if (ref) router.push(`/status/${encodeURIComponent(ref)}`);
  }

  return (
    <form
      onSubmit={trackQueue}
      className={cn(
        "flex flex-col sm:flex-row gap-2",
        compact ? "" : "w-full",
        className
      )}
    >
      <label htmlFor={`${idPrefix}-ref`} className="sr-only">
        Queue or appointment reference
      </label>
      <Input
        id={`${idPrefix}-ref`}
        placeholder="Your code (e.g. WALK-5 or APT…)"
        value={queueRef}
        onChange={(e) => setQueueRef(e.target.value)}
        className="font-mono h-12 min-h-[48px] bg-surface-container-lowest text-body-md"
        autoComplete="off"
      />
      <CareqButton type="submit" className="h-12 min-h-[48px] shrink-0 px-6">
        Check
      </CareqButton>
    </form>
  );
}

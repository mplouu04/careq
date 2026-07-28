"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function HeroQueueTrackForm() {
  const router = useRouter();
  const [queueRef, setQueueRef] = useState("");

  function trackQueue(e: React.FormEvent) {
    e.preventDefault();
    const ref = queueRef.trim();
    if (ref) router.push(`/status/${encodeURIComponent(ref)}`);
  }

  return (
    <form onSubmit={trackQueue} className="flex flex-col sm:flex-row gap-2">
      <label htmlFor="hero-queue-ref" className="sr-only">
        Queue reference number
      </label>
      <Input
        id="hero-queue-ref"
        placeholder="Track queue (e.g. WALK-5)"
        value={queueRef}
        onChange={(e) => setQueueRef(e.target.value)}
        className="font-mono h-11 bg-surface-container-lowest"
      />
      <Button type="submit" variant="secondary" className="h-11 shrink-0">
        View status
      </Button>
    </form>
  );
}

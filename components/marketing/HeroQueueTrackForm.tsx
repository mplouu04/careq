"use client";

import { QueueTrackForm } from "@/components/patient/QueueTrackForm";

/** @deprecated Prefer QueueTrackForm — kept for any remaining marketing imports. */
export function HeroQueueTrackForm() {
  return <QueueTrackForm idPrefix="hero-queue" compact />;
}

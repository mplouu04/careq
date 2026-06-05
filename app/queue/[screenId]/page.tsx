import { Suspense } from "react";
import { QueueBoard } from "@/components/queue/QueueBoard";

export default function QueueDisplayScreenPage({
  params,
}: {
  params: { screenId: string };
}) {
  return (
    <Suspense fallback={<div className="h-screen bg-surface flex items-center justify-center">Loading board…</div>}>
      <QueueBoard screenId={params.screenId} />
    </Suspense>
  );
}

import { Suspense } from "react";
import { QueueBoard } from "@/components/queue/QueueBoard";
import { QueueBoardSkeleton } from "@/components/careq";

export default function QueueDisplayScreenPage({
  params,
}: {
  params: { screenId: string };
}) {
  return (
    <Suspense fallback={<QueueBoardSkeleton />}>
      <QueueBoard screenId={params.screenId} />
    </Suspense>
  );
}

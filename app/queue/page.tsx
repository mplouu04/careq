import { Suspense } from "react";
import { QueueBoard } from "@/components/queue/QueueBoard";
import { QueueBoardSkeleton } from "@/components/careq";

export default function QueueDisplayPage() {
  return (
    <Suspense fallback={<QueueBoardSkeleton />}>
      <QueueBoard />
    </Suspense>
  );
}

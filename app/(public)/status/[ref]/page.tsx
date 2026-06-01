import { QueueStatus } from "@/components/queue/QueueStatus";

export default function StatusRefPage({
  params,
}: {
  params: { ref: string };
}) {
  const ref = decodeURIComponent(params.ref);
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-center">Queue Status</h1>
      <QueueStatus refNumber={ref} />
    </div>
  );
}

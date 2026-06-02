import { QueueStatus } from "@/components/queue/QueueStatus";

export default function StatusRefPage({
  params,
}: {
  params: { ref: string };
}) {
  const ref = decodeURIComponent(params.ref);
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <QueueStatus refNumber={ref} />
    </div>
  );
}

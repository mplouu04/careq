import { QueueStatus } from "@/components/queue/QueueStatus";
import { CareqPage } from "@/components/careq";

export default function StatusRefPage({
  params,
}: {
  params: { ref: string };
}) {
  const ref = decodeURIComponent(params.ref);
  return (
    <CareqPage narrow className="py-10">
      <QueueStatus refNumber={ref} />
    </CareqPage>
  );
}

import { QueueStatus } from "@/components/queue/QueueStatus";
import { ClinicHelpStrip } from "@/components/patient/ClinicHelpStrip";
import { CareqPage } from "@/components/careq";

export default function StatusRefPage({
  params,
}: {
  params: { ref: string };
}) {
  const ref = decodeURIComponent(params.ref);
  return (
    <CareqPage narrow className="py-10 space-y-6">
      <QueueStatus refNumber={ref} />
      <ClinicHelpStrip compact />
    </CareqPage>
  );
}

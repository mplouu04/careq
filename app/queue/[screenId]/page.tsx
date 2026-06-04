import { QueueBoard } from "@/components/queue/QueueBoard";

export default function QueueDisplayScreenPage({
  params,
}: {
  params: { screenId: string };
}) {
  return <QueueBoard screenId={params.screenId} />;
}

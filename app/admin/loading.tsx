import { AdminPanelSkeleton } from "@/components/careq";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading admin panel">
      <div>
        <Skeleton className="mb-2 h-4 w-32" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <AdminPanelSkeleton />
    </div>
  );
}

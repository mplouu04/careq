import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="flex flex-col gap-4" aria-label="Loading admin panel">
      <div>
        <Skeleton className="mb-2 h-4 w-32" />
        <Skeleton className="h-7 w-48" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]">
        <Skeleton className="h-64 rounded-xl" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-48" />
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

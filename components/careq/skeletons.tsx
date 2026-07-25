import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function StatsRowSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid grid-cols-1 sm:grid-cols-3 gap-3", className)}
      aria-label="Loading stats"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function QueueColumnsSkeleton({
  columns = 3,
  cardsPerColumn = 4,
  className,
}: {
  columns?: number;
  cardsPerColumn?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid md:grid-cols-3 gap-5", className)}
      aria-label="Loading queue"
      aria-busy="true"
    >
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="space-y-3">
          <Skeleton className="h-6 w-28" />
          {Array.from({ length: cardsPerColumn }).map((_, j) => (
            <Skeleton key={j} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function DashboardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-6", className)} aria-label="Loading dashboard" aria-busy="true">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <StatsRowSkeleton />
      <QueueColumnsSkeleton />
    </div>
  );
}

export function AdminPanelSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr]", className)}
      aria-label="Loading admin panel"
      aria-busy="true"
    >
      <Skeleton className="h-64 rounded-xl" />
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function DoctorCardsSkeleton({
  count = 4,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("grid gap-3 sm:grid-cols-2", className)}
      aria-label="Loading doctors"
      aria-busy="true"
    >
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function AppointmentListSkeleton({
  count = 3,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("space-y-3", className)} aria-label="Loading appointments" aria-busy="true">
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="h-28 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function QueueBoardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-col lg:flex-row h-screen", className)}
      aria-label="Loading queue board"
      aria-busy="true"
    >
      <div className="w-full lg:w-2/3 p-6 md:p-8 space-y-6">
        <Skeleton className="h-10 w-48 bg-white/20" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-xl bg-white/20" />
          ))}
        </div>
      </div>
      <div className="w-full lg:w-1/3 p-6 space-y-4 bg-muted/30">
        <Skeleton className="h-8 w-40" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}

export function FormPageSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("space-y-5 max-w-xl", className)} aria-label="Loading" aria-busy="true">
      <Skeleton className="h-8 w-56" />
      <Skeleton className="h-4 w-72 max-w-full" />
      <Skeleton className="h-64 w-full rounded-xl" />
    </div>
  );
}

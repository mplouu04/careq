import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type StatCardProps = {
  label: string;
  value: string;
  subtext?: string;
  icon?: LucideIcon;
  className?: string;
};

export function StatCard({ label, value, subtext, icon: Icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border border-outline-variant bg-surface-container-lowest p-md md:p-lg",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-label-sm text-on-surface-variant uppercase tracking-wide">
            {label}
          </p>
          <p className="text-headline-md text-primary font-semibold mt-1">{value}</p>
          {subtext && (
            <p className="text-body-sm text-on-surface-variant mt-1">{subtext}</p>
          )}
        </div>
        {Icon && (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-5 w-5" aria-hidden />
          </div>
        )}
      </div>
    </div>
  );
}

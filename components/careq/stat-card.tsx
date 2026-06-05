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
        "rounded-xl border border-outline-variant bg-surface-container-lowest p-4 min-h-[7rem] flex flex-col",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3 flex-1">
        <div className="min-w-0 flex-1">
          <p className="text-body-sm font-semibold text-on-surface-variant uppercase tracking-wide">
            {label}
          </p>
          <p className="text-headline-md text-primary font-bold mt-1.5 leading-tight">
            {value}
          </p>
          {subtext && (
            <p className="text-body-sm text-on-surface-variant mt-1.5 leading-snug">
              {subtext}
            </p>
          )}
        </div>
        {Icon && (
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
            aria-hidden
          >
            <Icon className="h-5 w-5" />
          </div>
        )}
      </div>
    </div>
  );
}

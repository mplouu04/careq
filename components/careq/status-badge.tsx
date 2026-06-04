import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-label-sm font-semibold uppercase tracking-wide",
  {
    variants: {
      status: {
        waiting: "bg-primary/10 text-primary",
        called: "bg-status-called/15 text-status-called",
        completed: "bg-muted text-muted-foreground",
        error: "bg-destructive/10 text-destructive",
        pending: "bg-secondary-container text-on-secondary-container",
        confirmed: "bg-status-called/15 text-status-called",
        cancelled: "bg-muted text-muted-foreground",
        no_show: "bg-amber-100 text-amber-900",
      },
    },
    defaultVariants: {
      status: "waiting",
    },
  }
);

export type QueueStatusVariant = NonNullable<
  VariantProps<typeof statusBadgeVariants>["status"]
>;

type StatusBadgeProps = React.ComponentProps<"span"> &
  VariantProps<typeof statusBadgeVariants> & {
    label?: string;
  };

export function StatusBadge({
  status,
  label,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span className={cn(statusBadgeVariants({ status }), className)} {...props}>
      {label ?? children}
    </span>
  );
}

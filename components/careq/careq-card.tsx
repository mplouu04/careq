import { cn } from "@/lib/utils";

type CareqCardProps = React.ComponentProps<"div"> & {
  hoverable?: boolean;
};

/**
 * Branded surface card — white background, subtle border, no layout-shift hover.
 */
export function CareqCard({
  className,
  hoverable,
  children,
  ...props
}: CareqCardProps) {
  return (
    <div
      className={cn(
        "careq-card",
        hoverable && "careq-card-interactive",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

import { cn } from "@/lib/utils";

type CareqPageProps = {
  children: React.ReactNode;
  className?: string;
  /** Narrow content column (forms) vs full width (dashboard-style) */
  narrow?: boolean;
};

/**
 * Standard page container: max width + responsive horizontal margins from the design system.
 */
export function CareqPage({ children, className, narrow }: CareqPageProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-margin-mobile md:px-margin-desktop py-8",
        narrow ? "max-w-2xl" : "max-w-careq",
        className
      )}
    >
      {children}
    </div>
  );
}

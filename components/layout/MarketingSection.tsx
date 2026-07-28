import { cn } from "@/lib/utils";

type MarketingSectionProps = {
  children: React.ReactNode;
  className?: string;
  /** Alternate background band */
  variant?: "default" | "muted" | "primary";
  id?: string;
};

const variantClass = {
  default: "bg-background",
  muted: "bg-surface-container-lowest",
  primary: "bg-primary text-primary-foreground",
};

export function MarketingSection({
  children,
  className,
  variant = "default",
  id,
}: MarketingSectionProps) {
  return (
    <section
      id={id}
      className={cn(
        "py-xxl px-margin-mobile md:px-margin-desktop",
        variantClass[variant],
        className
      )}
    >
      <div className="max-w-careq mx-auto">{children}</div>
    </section>
  );
}

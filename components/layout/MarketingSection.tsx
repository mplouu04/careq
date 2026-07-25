import { cn } from "@/lib/utils";

type MarketingSectionProps = {
  children: React.ReactNode;
  className?: string;
  /** Alternate background band */
  variant?: "default" | "muted" | "primary";
  id?: string;
};

const variantClass = {
  default: "bg-[#F8F9FB]",
  muted: "bg-white",
  primary: "bg-gradient-to-br from-blue-600 to-blue-800 text-white",
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
        "py-16 md:py-24 px-6",
        variantClass[variant],
        className
      )}
    >
      <div className="max-w-[1140px] mx-auto">{children}</div>
    </section>
  );
}

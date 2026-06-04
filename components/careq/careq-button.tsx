import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Primary action button with design-system touch target (44px) and rounded-xl styling.
 */
export function CareqButton({
  className,
  size = "lg",
  ...props
}: ButtonProps) {
  return (
    <Button
      className={cn("min-h-11 rounded-xl text-label-md", className)}
      size={size}
      {...props}
    />
  );
}

import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Primary action button with design-system touch target (44px).
 */
export function CareqButton({ className, size = "lg", ...props }: ButtonProps) {
  return <Button className={cn("min-h-11", className)} size={size} {...props} />;
}

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export type StepItem = {
  id: string;
  label: string;
};

type StepIndicatorProps = {
  steps: StepItem[];
  currentStep: string;
  className?: string;
};

export function StepIndicator({ steps, currentStep, className }: StepIndicatorProps) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);
  const current = steps[currentIndex];

  return (
    <nav aria-label="Progress" className={cn("w-full", className)}>
      {current && (
        <p className="sm:hidden text-label-sm text-on-surface font-semibold mb-3">
          Step {currentIndex + 1} of {steps.length}: {current.label}
        </p>
      )}
      <ol className="flex items-center gap-2 sm:gap-4">
        {steps.map((step, index) => {
          const done = index < currentIndex;
          const active = step.id === currentStep;
          return (
            <li key={step.id} className="flex flex-1 items-center gap-2 min-w-0">
              <span
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-label-sm font-semibold border-2 transition-colors",
                  done && "bg-primary border-primary text-primary-foreground",
                  active && !done && "border-primary text-primary bg-primary/10",
                  !done && !active && "border-outline-variant text-on-surface-variant"
                )}
                aria-current={active ? "step" : undefined}
                aria-label={`Step ${index + 1} of ${steps.length}: ${step.label}${
                  done ? ", completed" : active ? ", current" : ""
                }`}
              >
                {done ? <Check className="h-4 w-4" aria-hidden /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-label-sm truncate hidden sm:inline",
                  active ? "text-on-surface font-semibold" : "text-on-surface-variant"
                )}
              >
                {step.label}
              </span>
              {index < steps.length - 1 && (
                <span
                  className="hidden sm:block flex-1 h-px bg-outline-variant mx-1"
                  aria-hidden
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

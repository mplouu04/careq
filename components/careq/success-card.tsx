import Link from "next/link";
import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { CareqCard } from "./careq-card";
import { CareqButton } from "./careq-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type SuccessCta = {
  label: string;
  href: string;
};

type SuccessCardProps = {
  reference: string;
  message: string;
  primaryCta: SuccessCta;
  secondaryCta?: SuccessCta;
  className?: string;
  /** Extra content below CTAs (e.g. push notification opt-in). */
  footer?: ReactNode;
};

export function SuccessCard({
  reference,
  message,
  primaryCta,
  secondaryCta,
  className,
  footer,
}: SuccessCardProps) {
  return (
    <CareqCard className={cn("overflow-hidden p-6 text-center", className)}>
      <CheckCircle2 className="h-10 w-10 text-primary mx-auto mb-3" aria-hidden />
      <p className="text-headline-sm font-mono-careq text-on-surface mb-2">{reference}</p>
      <p className="text-body-sm text-on-surface-variant mb-6">{message}</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <CareqButton asChild className="min-h-[44px]">
          <Link href={primaryCta.href}>{primaryCta.label}</Link>
        </CareqButton>
        {secondaryCta && (
          <Button variant="ghost" asChild className="min-h-[44px] rounded-xl">
            <Link href={secondaryCta.href}>{secondaryCta.label}</Link>
          </Button>
        )}
      </div>
      {footer && <div className="mt-4">{footer}</div>}
    </CareqCard>
  );
}

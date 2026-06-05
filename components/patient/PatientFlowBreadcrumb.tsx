import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Crumb = { label: string; href?: string };

const FUNNELS: Record<string, Crumb[]> = {
  visit: [{ label: "Home", href: "/" }, { label: "Visit" }],
  search: [
    { label: "Home", href: "/" },
    { label: "Visit", href: "/visit" },
    { label: "Search" },
  ],
  registration: [
    { label: "Home", href: "/" },
    { label: "Visit", href: "/visit" },
    { label: "Register" },
  ],
  checkin: [
    { label: "Home", href: "/" },
    { label: "Visit", href: "/visit" },
    { label: "Search", href: "/patient-search" },
    { label: "Check-in" },
  ],
};

export function PatientFlowBreadcrumb({
  flow,
  className,
}: {
  flow: keyof typeof FUNNELS;
  className?: string;
}) {
  const crumbs = FUNNELS[flow];
  return (
    <nav
      aria-label="Progress"
      className={cn("flex flex-wrap items-center gap-1 text-body-sm text-on-surface-variant mb-6", className)}
    >
      {crumbs.map((c, i) => (
        <span key={c.label} className="inline-flex items-center gap-1">
          {i > 0 && <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden />}
          {c.href ? (
            <Link href={c.href} className="hover:text-primary transition-colors">
              {c.label}
            </Link>
          ) : (
            <span className="text-on-surface font-medium">{c.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}

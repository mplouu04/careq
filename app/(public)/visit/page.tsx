import Link from "next/link";
import { History, UserPlus, Building2 } from "lucide-react";
import { CareqPage } from "@/components/careq";
import { cn } from "@/lib/utils";

const choiceCardClass =
  "group relative flex flex-col items-center p-lg border border-outline-variant rounded-xl hover:border-primary hover:bg-surface-container-low transition-all duration-300";

export default function VisitPage() {
  return (
    <CareqPage narrow className="py-12 flex items-center justify-center min-h-[calc(100vh-8rem)]">
      <section className="careq-card w-full p-xl md:p-xxl flex flex-col items-center text-center">
        <div className="mb-lg w-20 h-20 rounded-full bg-secondary-container flex items-center justify-center text-primary">
          <Building2 className="h-10 w-10" aria-hidden />
        </div>
        <h1 className="text-headline-lg md:text-[32px] font-bold text-on-surface mb-md">
          Welcome to CAREQ
        </h1>
        <p className="text-body-lg text-on-surface-variant mb-xl max-w-sm">
          Have you been here before, or is this your first visit?
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-md w-full max-w-lg">
          <Link href="/patient-search" className={choiceCardClass}>
            <div className="mb-md w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <History className="h-6 w-6" aria-hidden />
            </div>
            <span className="text-label-md text-on-surface">Yes, I&apos;ve been here before</span>
          </Link>
          <Link href="/registration" className={choiceCardClass}>
            <div className="mb-md w-12 h-12 rounded-full bg-secondary-container flex items-center justify-center text-on-secondary-container group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <UserPlus className="h-6 w-6" aria-hidden />
            </div>
            <span className="text-label-md text-on-surface">No, this is my first visit</span>
          </Link>
        </div>
        <Link
          href="/"
          className={cn(
            "mt-xl text-label-sm text-on-surface-variant hover:text-primary transition-colors"
          )}
        >
          ← Back to home
        </Link>
      </section>
    </CareqPage>
  );
}

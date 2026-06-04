import Link from "next/link";
import { HelpCircle } from "lucide-react";
import { CareqPage, CareqCard, CareqButton, PageHeader } from "@/components/careq";
import { Button } from "@/components/ui/button";

export default function VisitPage() {
  return (
    <CareqPage narrow className="py-12">
      <PageHeader
        title="Have you been here before?"
        subtitle="Please select one of the options below to continue."
        backHref="/"
        backLabel="Home"
      />
      <CareqCard className="p-10 text-center">
        <HelpCircle className="w-16 h-16 text-primary mx-auto mb-6" aria-hidden />
        <div className="flex flex-col gap-3 max-w-xs mx-auto">
          <CareqButton asChild className="w-full">
            <Link href="/patient-search">Yes, I&apos;ve been here before</Link>
          </CareqButton>
          <Button asChild variant="outline" className="h-11 w-full border-2 border-primary text-primary hover:bg-primary/5">
            <Link href="/registration">No, this is my first visit</Link>
          </Button>
        </div>
      </CareqCard>
    </CareqPage>
  );
}

import { Suspense } from "react";
import { CareqPage, PageHeader, FormPageSkeleton } from "@/components/careq";
import { ClinicHelpStrip } from "@/components/patient/ClinicHelpStrip";
import { StatusLookupForm } from "@/components/patient/StatusLookupForm";

export default function StatusLookupPage() {
  return (
    <CareqPage narrow className="space-y-6">
      <PageHeader
        title="Track my line"
        subtitle="Enter the code from your check-in or booking confirmation"
        backHref="/"
      />
      <Suspense fallback={<FormPageSkeleton />}>
        <StatusLookupForm />
      </Suspense>
      <ClinicHelpStrip compact />
    </CareqPage>
  );
}

import { Suspense } from "react";
import { CheckinForm } from "@/components/patient/CheckinForm";
import { PatientFlowBreadcrumb } from "@/components/patient/PatientFlowBreadcrumb";
import { ClinicHelpStrip } from "@/components/patient/ClinicHelpStrip";
import { CareqPage, FormPageSkeleton, PageHeader } from "@/components/careq";

export default function CheckinPage() {
  return (
    <CareqPage narrow className="space-y-6">
      <PatientFlowBreadcrumb flow="checkin" />
      <PageHeader
        title="I'm here"
        subtitle="Check in with your booking code, or as a walk-in after verifying your identity."
        backHref="/"
      />
      <Suspense fallback={<FormPageSkeleton />}>
        <CheckinForm />
      </Suspense>
      <ClinicHelpStrip compact />
    </CareqPage>
  );
}

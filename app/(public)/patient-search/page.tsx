import { Suspense } from "react";
import { PatientSearch } from "@/components/patient/PatientSearch";
import { PatientFlowBreadcrumb } from "@/components/patient/PatientFlowBreadcrumb";
import { ClinicHelpStrip } from "@/components/patient/ClinicHelpStrip";
import { CareqPage, PageHeader } from "@/components/careq";

export default function PatientSearchPage() {
  return (
    <CareqPage narrow className="space-y-6">
      <PatientFlowBreadcrumb flow="search" />
      <PageHeader
        title="Who is visiting?"
        subtitle="Enter the patient's date of birth and phone number. We only show a first name to confirm it is you."
        backHref="/"
      />
      <Suspense fallback={<p className="text-body-md text-on-surface-variant">Loading…</p>}>
        <PatientSearch />
      </Suspense>
      <ClinicHelpStrip compact />
    </CareqPage>
  );
}

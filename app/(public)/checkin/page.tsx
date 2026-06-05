import { Suspense } from "react";
import { CheckinForm } from "@/components/patient/CheckinForm";
import { PatientFlowBreadcrumb } from "@/components/patient/PatientFlowBreadcrumb";
import { CareqPage, PageHeader } from "@/components/careq";

export default function CheckinPage() {
  return (
    <CareqPage narrow>
      <PatientFlowBreadcrumb flow="checkin" />
      <PageHeader title="Patient Check-In" backHref="/visit" />
      <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
        <CheckinForm />
      </Suspense>
    </CareqPage>
  );
}

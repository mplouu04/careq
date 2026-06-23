import { PatientSearch } from "@/components/patient/PatientSearch";
import { PatientFlowBreadcrumb } from "@/components/patient/PatientFlowBreadcrumb";
import { CareqPage, PageHeader } from "@/components/careq";

export default function PatientSearchPage() {
  return (
    <CareqPage narrow>
      <PatientFlowBreadcrumb flow="search" />
      <PageHeader
        title="Find your profile"
        subtitle="Enter your date of birth and phone number to verify your identity."
        backHref="/visit"
      />
      <PatientSearch />
    </CareqPage>
  );
}

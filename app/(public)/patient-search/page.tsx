import { PatientSearch } from "@/components/patient/PatientSearch";
import { ClinicStatusBar } from "@/components/patient/ClinicStatusBar";
import { PatientFlowBreadcrumb } from "@/components/patient/PatientFlowBreadcrumb";
import { CareqPage, PageHeader } from "@/components/careq";

export default function PatientSearchPage() {
  return (
    <CareqPage>
      <PatientFlowBreadcrumb flow="search" />
      <PageHeader
        title="Patient reception"
        subtitle="Search for an existing patient to check in or book an appointment."
        backHref="/visit"
      />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-xl">
        <div className="lg:col-span-8">
          <PatientSearch />
        </div>
        <aside className="lg:col-span-4 space-y-md">
          <ClinicStatusBar />
        </aside>
      </div>
    </CareqPage>
  );
}

import { PatientSearch } from "@/components/patient/PatientSearch";
import { CareqPage, PageHeader } from "@/components/careq";

export default function PatientSearchPage() {
  return (
    <CareqPage narrow>
      <PageHeader
        title="Find Your Profile"
        subtitle="Search for an existing patient to book an appointment or check in."
        backHref="/visit"
      />
      <PatientSearch />
    </CareqPage>
  );
}

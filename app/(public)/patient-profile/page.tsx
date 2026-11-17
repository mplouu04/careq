import { PatientProfile } from "@/components/patient/PatientProfile";
import { ClinicHelpStrip } from "@/components/patient/ClinicHelpStrip";
import { CareqPage, PageHeader } from "@/components/careq";

export default function PatientProfilePage() {
  return (
    <CareqPage narrow className="space-y-6">
      <PageHeader
        title="My profile"
        subtitle="View or update your registered contact details."
        backHref="/"
      />
      <PatientProfile />
      <ClinicHelpStrip compact />
    </CareqPage>
  );
}
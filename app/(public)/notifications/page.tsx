import { PatientNotifications } from "@/components/patient/PatientNotifications";
import { ClinicHelpStrip } from "@/components/patient/ClinicHelpStrip";
import { CareqPage, PageHeader } from "@/components/careq";

export default function NotificationsPage() {
  return (
    <CareqPage narrow className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Appointment confirmations, approvals, and clinic updates."
        backHref="/"
      />
      <PatientNotifications />
      <ClinicHelpStrip compact />
    </CareqPage>
  );
}
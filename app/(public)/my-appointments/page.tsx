import { MyAppointments } from "@/components/patient/MyAppointments";
import { ClinicHelpStrip } from "@/components/patient/ClinicHelpStrip";
import { CareqPage, PageHeader } from "@/components/careq";

export default function MyAppointmentsPage() {
  return (
    <CareqPage narrow className="space-y-6">
      <PageHeader
        title="My visits"
        subtitle="Find or cancel a booking with your phone and date of birth, or with your appointment code."
        backHref="/"
      />
      <MyAppointments />
      <ClinicHelpStrip compact />
    </CareqPage>
  );
}

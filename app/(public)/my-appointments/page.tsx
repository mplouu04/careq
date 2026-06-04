import { MyAppointments } from "@/components/patient/MyAppointments";
import { CareqPage, PageHeader } from "@/components/careq";

export default function MyAppointmentsPage() {
  return (
    <CareqPage narrow>
      <PageHeader
        title="My Appointments"
        subtitle="Enter your phone and date of birth to view or cancel your appointments."
        backHref="/"
      />
      <MyAppointments />
    </CareqPage>
  );
}

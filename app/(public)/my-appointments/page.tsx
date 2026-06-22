import { MyAppointments } from "@/components/patient/MyAppointments";
import { CareqPage, PageHeader } from "@/components/careq";

export default function MyAppointmentsPage() {
  return (
    <CareqPage narrow>
      <PageHeader
        title="My Appointments"
        subtitle="Look up by phone and date of birth, or by appointment reference, to view or cancel appointments."
        backHref="/"
      />
      <MyAppointments />
    </CareqPage>
  );
}

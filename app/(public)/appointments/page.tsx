import { Suspense } from "react";
import { AppointmentForm } from "@/components/patient/AppointmentForm";
import { CareqPage, PageHeader } from "@/components/careq";

export default function AppointmentsPage() {
  return (
    <CareqPage narrow>
      <PageHeader title="Book an Appointment" backHref="/patient-search" />
      <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
        <AppointmentForm />
      </Suspense>
    </CareqPage>
  );
}

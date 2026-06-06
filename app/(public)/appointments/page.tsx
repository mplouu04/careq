import { Suspense } from "react";
import { AppointmentBooking } from "@/components/patient/AppointmentBooking";
import { CareqPage } from "@/components/careq";

export default function AppointmentsPage() {
  return (
    <CareqPage narrow className="max-w-3xl">
      <Suspense fallback={<p className="text-muted-foreground">Loading...</p>}>
        <AppointmentBooking />
      </Suspense>
    </CareqPage>
  );
}

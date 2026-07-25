import { Suspense } from "react";
import { AppointmentBooking } from "@/components/patient/AppointmentBooking";
import { CareqPage, DoctorCardsSkeleton } from "@/components/careq";

export default function AppointmentsPage() {
  return (
    <CareqPage narrow className="max-w-3xl">
      <Suspense fallback={<DoctorCardsSkeleton className="mt-4" />}>
        <AppointmentBooking />
      </Suspense>
    </CareqPage>
  );
}

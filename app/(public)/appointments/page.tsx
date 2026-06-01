import { Suspense } from "react";
import { AppointmentForm } from "@/components/patient/AppointmentForm";

export default function AppointmentsPage() {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Book Appointment</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <AppointmentForm />
      </Suspense>
    </div>
  );
}

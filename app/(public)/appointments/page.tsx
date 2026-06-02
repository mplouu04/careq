import { Suspense } from "react";
import { AppointmentForm } from "@/components/patient/AppointmentForm";

export default function AppointmentsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="max-w-lg mx-auto space-y-5">
        <h1 className="text-3xl font-bold text-gray-800">Book an Appointment</h1>
        <Suspense fallback={<p className="text-gray-500">Loading...</p>}>
          <AppointmentForm />
        </Suspense>
      </div>
    </div>
  );
}

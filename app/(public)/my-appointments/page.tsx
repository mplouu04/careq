import { MyAppointments } from "@/components/patient/MyAppointments";

export default function MyAppointmentsPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="max-w-lg mx-auto space-y-4">
        <h1 className="text-3xl font-bold text-gray-800">My Appointments</h1>
        <p className="text-gray-500">
          Enter your phone and date of birth to view or cancel your appointments.
        </p>
        <MyAppointments />
      </div>
    </div>
  );
}

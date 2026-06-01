import { MyAppointments } from "@/components/patient/MyAppointments";

export default function MyAppointmentsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">My Appointments</h1>
      <p className="text-muted-foreground">
        Enter your phone and date of birth to view or cancel appointments.
      </p>
      <MyAppointments />
    </div>
  );
}

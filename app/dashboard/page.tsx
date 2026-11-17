import { getStaffSession } from "@/lib/auth";
import { DashboardQueue } from "@/components/staff/DashboardQueue";
import { DoctorDashboard } from "@/components/staff/DoctorDashboard";

export default async function DashboardPage() {
  const session = await getStaffSession();
  if (session!.staff.role === "doctor") {
    return <DoctorDashboard staff={session!.staff} />;
  }
  return <DashboardQueue staff={session!.staff} />;
}

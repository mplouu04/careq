import { getStaffSession } from "@/lib/auth";
import { DashboardQueue } from "@/components/staff/DashboardQueue";

export default async function DashboardPage() {
  const session = await getStaffSession();
  return <DashboardQueue staff={session!.staff} />;
}

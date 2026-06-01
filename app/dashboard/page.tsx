import { getStaffSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardQueue } from "@/components/staff/DashboardQueue";

export default async function DashboardPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Staff Dashboard</h1>
      <DashboardQueue staff={session.staff} />
    </div>
  );
}

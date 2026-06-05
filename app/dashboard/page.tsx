import { getStaffSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardQueue } from "@/components/staff/DashboardQueue";

export default async function DashboardPage() {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  return <DashboardQueue staff={session.staff} />;
}

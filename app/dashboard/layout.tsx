import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";
import { StaffHeader } from "@/components/layout/StaffHeader";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  return (
    <>
      <StaffHeader staff={session.staff} />
      <main className="container mx-auto px-4 py-6">{children}</main>
    </>
  );
}

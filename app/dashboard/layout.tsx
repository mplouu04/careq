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
    <div className="min-h-screen" style={{ backgroundColor: "#f8f9fa" }}>
      <StaffHeader staff={session.staff} />
      <main className="max-w-7xl mx-auto px-4 2xl:px-8 py-8">{children}</main>
    </div>
  );
}

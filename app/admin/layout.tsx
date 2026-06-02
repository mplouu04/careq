import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";
import { StaffHeader } from "@/components/layout/StaffHeader";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.staff.role !== "admin") redirect("/dashboard");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8f9fa" }}>
      <StaffHeader staff={session.staff} />
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}

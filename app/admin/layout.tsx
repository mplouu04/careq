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
    <div className="min-h-screen bg-background">
      <StaffHeader staff={session.staff} />
      <main className="max-w-careq mx-auto px-margin-mobile md:px-margin-desktop py-8">
        {children}
      </main>
    </div>
  );
}

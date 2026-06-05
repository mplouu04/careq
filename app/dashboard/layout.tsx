import { redirect } from "next/navigation";
import { getStaffSession } from "@/lib/auth";
import { StaffHeader } from "@/components/layout/StaffHeader";
import { SkipToContent } from "@/components/layout/SkipToContent";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <SkipToContent />
      <StaffHeader staff={session.staff} />
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-careq mx-auto px-margin-mobile md:px-margin-desktop py-8 outline-none"
      >
        {children}
      </main>
    </div>
  );
}

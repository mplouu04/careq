import { redirect } from "next/navigation";
import { Inter } from "next/font/google";
import { getStaffSession } from "@/lib/auth";
import { AdminHeader } from "@/components/admin/AdminHeader";
import { SkipToContent } from "@/components/layout/SkipToContent";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-admin",
});

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getStaffSession();
  if (!session) redirect("/login");
  if (session.staff.role !== "admin") redirect("/dashboard");

  return (
    <div
      className={`${inter.variable} min-h-screen bg-[#F3F4F6] font-[family-name:var(--font-admin),Inter,system-ui,sans-serif]`}
    >
      <SkipToContent />
      <AdminHeader staff={session.staff} />
      <main
        id="main-content"
        tabIndex={-1}
        className="px-6 py-7 outline-none"
      >
        {children}
      </main>
    </div>
  );
}

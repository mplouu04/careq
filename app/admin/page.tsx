import { AdminPanel } from "@/components/staff/AdminPanel";

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-[13px] text-[#6B7280]">Clinic management</p>
        <h1 className="text-xl font-bold text-[#111827]">Admin Panel</h1>
        <p className="mt-1 text-sm text-[#6B7280]">
          Manage staff, appointment types, display screens, and clinic data.
        </p>
      </header>
      <AdminPanel />
    </div>
  );
}

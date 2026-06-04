import { AdminPanel } from "@/components/staff/AdminPanel";
import { PageHeader } from "@/components/careq";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Panel"
        subtitle="Manage staff, appointment types, display screens, and clinic data."
      />
      <AdminPanel />
    </div>
  );
}

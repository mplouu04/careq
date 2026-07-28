import { AdminPanel } from "@/components/admin/AdminPanel";

export default function AdminPage() {
  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="text-body-sm text-on-surface-variant">Clinic management</p>
        <h1 className="text-headline-sm text-on-surface">Admin Panel</h1>
        <p className="mt-1 text-body-sm text-on-surface-variant">
          Manage staff, appointment types, display screens, and clinic data.
        </p>
      </header>
      <AdminPanel />
    </div>
  );
}

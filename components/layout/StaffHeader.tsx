"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import type { StaffProfile } from "@/lib/auth";

export function StaffHeader({ staff }: { staff: StaffProfile }) {
  const router = useRouter();

  async function logout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-slate-900 text-white">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/dashboard" className="text-xl font-bold">
          CAREQ Staff
        </Link>
        <nav className="flex items-center gap-2">
          <span className="text-sm text-slate-300 hidden sm:inline">
            {staff.first_name} {staff.last_name} ({staff.role})
          </span>
          <Button variant="secondary" size="sm" asChild>
            <Link href="/dashboard">Dashboard</Link>
          </Button>
          {staff.role === "admin" && (
            <Button variant="secondary" size="sm" asChild>
              <Link href="/admin">Admin</Link>
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={logout} className="text-white border-white/30">
            Logout
          </Button>
        </nav>
      </div>
    </header>
  );
}

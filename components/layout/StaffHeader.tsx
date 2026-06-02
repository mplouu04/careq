"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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

  const displayName =
    staff.role === "doctor"
      ? `Dr. ${staff.last_name}`
      : `${staff.first_name} ${staff.last_name}`;

  return (
    <nav className="careq-navbar sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Brand */}
        <Link href="/" className="text-xl font-bold text-white">
          CAREQ
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-1 flex-1 ml-6">
          <Link
            href="/dashboard"
            className="text-white/90 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded text-sm font-medium transition-colors"
          >
            Dashboard
          </Link>
          <Link
            href="/queue"
            target="_blank"
            className="text-white/90 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded text-sm font-medium transition-colors"
          >
            Queue Display
          </Link>
          {staff.role === "admin" && (
            <Link
              href="/admin"
              className="text-white/90 hover:text-white hover:bg-white/10 px-3 py-1.5 rounded text-sm font-medium transition-colors"
            >
              Admin
            </Link>
          )}
        </div>

        {/* Right side: user name + logout */}
        <div className="flex items-center gap-3">
          <span className="text-white text-sm hidden md:inline">{displayName}</span>
          <button
            onClick={logout}
            className="text-white border border-white/40 hover:bg-white/10 rounded px-3 py-1 text-sm font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}

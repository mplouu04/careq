"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { StaffProfile } from "@/lib/auth";

export function StaffHeader({ staff }: { staff: StaffProfile }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close mobile menu on navigation
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function logout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Proceed to login regardless of signOut error
    }
    router.push("/login");
    router.refresh();
  }

  const displayName =
    staff.role === "doctor"
      ? `Dr. ${staff.last_name}`
      : `${staff.first_name} ${staff.last_name}`;

  const navLinks = (
    <>
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
    </>
  );

  return (
    <nav className="careq-navbar sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        {/* Brand */}
        <Link href="/" className="text-xl font-bold text-white">
          CAREQ
        </Link>

        {/* Desktop nav links */}
        <div className="hidden sm:flex items-center gap-1 flex-1 ml-6">
          {navLinks}
        </div>

        {/* Right side: user name + logout + hamburger */}
        <div className="flex items-center gap-3">
          <span className="text-white text-sm hidden md:inline">{displayName}</span>
          <button
            onClick={logout}
            className="text-white border border-white/40 hover:bg-white/10 rounded px-3 py-1 text-sm font-medium transition-colors"
          >
            Logout
          </button>
          {/* Hamburger — mobile only */}
          <button
            className="sm:hidden text-white p-1 rounded hover:bg-white/10 transition-colors"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div className="sm:hidden bg-[#0b5ed7] border-t border-white/10 flex flex-col">
          <span className="px-4 py-2 text-white/60 text-xs font-medium uppercase tracking-wide border-b border-white/10">
            {displayName}
          </span>
          <Link
            href="/dashboard"
            className="px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors border-b border-white/10"
          >
            Dashboard
          </Link>
          <Link
            href="/queue"
            target="_blank"
            className="px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors border-b border-white/10"
          >
            Queue Display
          </Link>
          {staff.role === "admin" && (
            <Link
              href="/admin"
              className="px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors border-b border-white/10"
            >
              Admin
            </Link>
          )}
          <button
            onClick={logout}
            className="px-4 py-3 text-left text-white/90 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors"
          >
            Logout
          </button>
        </div>
      )}
    </nav>
  );
}

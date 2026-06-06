"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { StaffProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";

export function AdminHeader({ staff }: { staff: StaffProfile }) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  async function logout() {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {
      // Proceed to login regardless
    }
    router.push("/login");
    router.refresh();
  }

  const displayName =
    staff.role === "doctor"
      ? `Dr. ${staff.last_name}`
      : `${staff.first_name} ${staff.last_name}`;

  const links = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/queue", label: "Queue Display", external: true },
    { href: "/admin", label: "Admin" },
  ] as const;

  const linkClass = (href: string) =>
    cn(
      "rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors",
      pathname === href || (href === "/dashboard" && pathname.startsWith("/dashboard"))
        ? "bg-[#EFF6FF] text-[#2563EB]"
        : "text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#111827]"
    );

  return (
    <header className="sticky top-0 z-50 border-b border-[#E5E7EB] bg-white">
      <div className="flex h-[52px] items-center justify-between px-6">
        <div className="flex min-w-0 flex-1 items-center gap-6">
          <Link
            href="/dashboard"
            className="shrink-0 text-lg font-bold text-[#2563EB]"
          >
            CAREQ
          </Link>
          <nav className="hidden items-center gap-1 sm:flex" aria-label="Staff">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                target={"external" in link && link.external ? "_blank" : undefined}
                rel={"external" in link && link.external ? "noopener noreferrer" : undefined}
                className={linkClass(link.href)}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="hidden max-w-[160px] truncate text-sm text-[#6B7280] md:inline">
            {displayName}
          </span>
          <button
            type="button"
            onClick={logout}
            className="hidden items-center gap-1.5 rounded-full border border-[#D1D5DB] px-3.5 py-1.5 text-sm font-medium text-[#374151] transition-colors hover:bg-[#F9FAFB] sm:inline-flex"
          >
            <LogOut className="h-3.5 w-3.5" />
            Logout
          </button>
          <button
            type="button"
            className="rounded-lg p-1 text-[#2563EB] hover:bg-[#F9FAFB] sm:hidden"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav
          className="flex flex-col border-t border-[#E5E7EB] bg-white sm:hidden"
          aria-label="Staff mobile"
        >
          <span className="border-b border-[#E5E7EB] px-4 py-2 text-xs uppercase tracking-wide text-[#9CA3AF]">
            {displayName}
          </span>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target={"external" in link && link.external ? "_blank" : undefined}
              rel={"external" in link && link.external ? "noopener noreferrer" : undefined}
              className={cn("border-b border-[#E5E7EB] px-4 py-3", linkClass(link.href))}
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={logout}
            className="flex items-center gap-2 px-4 py-3 text-left text-sm text-[#6B7280] hover:text-[#2563EB]"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </nav>
      )}
    </header>
  );
}

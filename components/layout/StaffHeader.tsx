"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, X, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { StaffProfile } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function StaffHeader({ staff }: { staff: StaffProfile }) {
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
    ...(staff.role === "admin" ? [{ href: "/admin", label: "Admin" }] : []),
  ] as const;

  const linkClass = (href: string) =>
    cn(
      "text-body-md font-medium transition-colors px-3 py-1.5 rounded-lg",
      pathname === href || (href === "/dashboard" && pathname.startsWith("/dashboard"))
        ? "text-primary font-semibold bg-primary/10"
        : "text-on-surface-variant hover:text-primary hover:bg-surface-container-low"
    );

  return (
    <header className="careq-navbar sticky top-0 z-50">
      <div className="max-w-careq mx-auto px-margin-mobile md:px-margin-desktop flex items-center justify-between h-16">
        <div className="flex items-center gap-lg flex-1 min-w-0">
          <Link href="/dashboard" className="text-headline-md font-bold text-primary shrink-0">
            CAREQ
          </Link>
          <nav className="hidden sm:flex items-center gap-1" aria-label="Staff">
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
          <span className="text-body-sm text-on-surface-variant hidden md:inline truncate max-w-[160px]">
            {displayName}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={logout}
            className="hidden sm:inline-flex gap-1"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
          <button
            type="button"
            className="sm:hidden text-primary p-1 rounded-lg hover:bg-muted"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="sm:hidden border-t border-border bg-card flex flex-col" aria-label="Staff mobile">
          <span className="px-4 py-2 text-label-sm text-muted-foreground uppercase tracking-wide border-b border-border">
            {displayName}
          </span>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              target={"external" in link && link.external ? "_blank" : undefined}
              rel={"external" in link && link.external ? "noopener noreferrer" : undefined}
              className={cn("px-4 py-3 border-b border-border", linkClass(link.href))}
            >
              {link.label}
            </Link>
          ))}
          <button
            type="button"
            onClick={logout}
            className="px-4 py-3 text-left text-body-sm text-muted-foreground hover:text-primary flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </nav>
      )}
    </header>
  );
}

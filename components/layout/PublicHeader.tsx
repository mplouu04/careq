"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/visit", label: "Check In" },
  { href: "/status", label: "Queue Status" },
] as const;

export function PublicHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const navLinkClass = (href: string) =>
    cn(
      "text-body-md font-medium transition-colors pb-0.5",
      pathname === href || (href === "/visit" && pathname.startsWith("/checkin"))
        ? "text-primary font-bold border-b-2 border-primary"
        : "text-muted-foreground hover:text-primary"
    );

  return (
    <header className="careq-navbar sticky top-0 z-50">
      <div className="max-w-careq mx-auto px-margin-mobile md:px-margin-desktop flex items-center justify-between h-16">
        <div className="flex items-center gap-8">
          <Link href="/" className="text-headline-md font-bold text-primary">
            CAREQ
          </Link>
          <nav className="hidden md:flex items-center gap-6" aria-label="Main">
            {NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className={navLinkClass(href)}>
                {label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden sm:flex items-center gap-4">
          <Link
            href="/queue"
            target="_blank"
            rel="noopener noreferrer"
            className="text-body-sm text-muted-foreground hover:text-primary transition-colors"
          >
            Queue Board
          </Link>
          <Link
            href="/login"
            className="text-body-md text-muted-foreground hover:text-primary transition-colors"
          >
            Staff Login
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden text-primary p-1 rounded-lg hover:bg-muted transition-colors"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <nav
          className="md:hidden border-t border-border bg-card flex flex-col"
          aria-label="Mobile"
        >
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn("px-4 py-3 border-b border-border", navLinkClass(href))}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/queue"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-3 text-body-md text-muted-foreground hover:text-primary border-b border-border"
          >
            Queue Board
          </Link>
          <Link
            href="/login"
            className="px-4 py-3 text-body-md text-muted-foreground hover:text-primary"
          >
            Staff Login
          </Link>
        </nav>
      )}
    </header>
  );
}

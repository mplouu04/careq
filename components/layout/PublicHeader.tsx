"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/visit", label: "Check in" },
  { href: "/appointments", label: "Book" },
  { href: "/my-appointments", label: "My appointments" },
  { href: "/status", label: "Queue status" },
] as const;

function isNavActive(href: string, pathname: string): boolean {
  if (href === "/visit") {
    return (
      pathname === "/visit" ||
      pathname.startsWith("/patient-search") ||
      pathname.startsWith("/registration") ||
      (pathname.startsWith("/checkin") && !pathname.startsWith("/appointments"))
    );
  }
  if (href === "/appointments") {
    return pathname.startsWith("/appointments");
  }
  if (href === "/my-appointments") {
    return pathname.startsWith("/my-appointments");
  }
  if (href === "/status") {
    return pathname === "/status" || pathname.startsWith("/status/");
  }
  return pathname === href;
}

export function PublicHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  const navLinkClass = (href: string) =>
    cn(
      "text-body-sm md:text-body-md font-medium transition-colors py-2 md:py-0 md:pb-1 min-h-[44px] md:min-h-0 flex items-center",
      isNavActive(href, pathname)
        ? "text-primary font-bold md:border-b-2 md:border-primary"
        : "text-on-surface-variant hover:text-primary"
    );

  return (
    <header className="careq-navbar sticky top-0 z-50">
      <div className="max-w-careq mx-auto px-margin-mobile md:px-margin-desktop flex items-center justify-between min-h-16 h-auto md:h-16 py-2 md:py-0 gap-2">
        <div className="flex items-center gap-md md:gap-lg min-w-0 flex-1">
          <Link href="/" className="text-headline-md font-bold text-primary shrink-0">
            CAREQ
          </Link>
          <nav
            className="hidden md:flex items-center gap-md xl:gap-lg"
            aria-label="Main"
          >
            {NAV_LINKS.map(({ href, label }) => {
              const active = isNavActive(href, pathname);
              return (
                <Link
                  key={href}
                  href={href}
                  className={navLinkClass(href)}
                  aria-current={active ? "page" : undefined}
                >
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="hidden sm:flex items-center gap-md shrink-0">
          <Link
            href="/login"
            className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-lg text-body-md font-medium text-primary border border-outline-variant hover:bg-surface-container-low transition-colors"
          >
            Staff login
          </Link>
        </div>

        <button
          type="button"
          className="md:hidden text-primary p-2 rounded-lg hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
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
          {NAV_LINKS.map(({ href, label }) => {
            const active = isNavActive(href, pathname);
            return (
              <Link
                key={href}
                href={href}
                className={cn("px-4 border-b border-border", navLinkClass(href))}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
          <Link
            href="/login"
            className="px-4 py-3 text-body-md text-on-surface-variant hover:text-primary min-h-[44px] flex items-center sm:hidden"
          >
            Staff login
          </Link>
        </nav>
      )}
    </header>
  );
}

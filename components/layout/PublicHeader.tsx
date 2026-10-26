"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

/** Trimmed patient nav — Home / Book / Track / My visits */
const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/patient-search?intent=book", label: "Book", match: "/appointments" },
  { href: "/status", label: "Track" },
  { href: "/my-appointments", label: "My visits" },
] as const;

function isNavActive(
  href: string,
  pathname: string,
  match?: string
): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  if (match && pathname.startsWith(match)) return true;
  if (href.startsWith("/patient-search")) {
    return (
      pathname.startsWith("/patient-search") ||
      pathname.startsWith("/appointments") ||
      pathname.startsWith("/registration")
    );
  }
  if (href === "/status") {
    return pathname === "/status" || pathname.startsWith("/status/");
  }
  if (href === "/my-appointments") {
    return pathname.startsWith("/my-appointments");
  }
  return pathname === href || pathname.startsWith(href);
}

export function PublicHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const firstLink = menuRef.current?.querySelector<HTMLElement>("a");
    firstLink?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const navLinkClass = (active: boolean) =>
    cn(
      "text-body-sm md:text-body-md font-medium transition-colors py-2 md:py-0 md:pb-1 min-h-[44px] md:min-h-0 flex items-center",
      active
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
            {NAV_LINKS.map(({ href, label, ...rest }) => {
              const match = "match" in rest ? rest.match : undefined;
              const active = isNavActive(href, pathname, match);
              return (
                <Link
                  key={href}
                  href={href}
                  className={navLinkClass(active)}
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
            href="/checkin"
            className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-lg text-body-md font-semibold text-primary-foreground bg-primary hover:opacity-95 transition-opacity"
          >
            I&apos;m here
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center min-h-[44px] px-4 rounded-lg text-body-md font-medium text-primary border border-outline-variant hover:bg-surface-container-low transition-colors"
          >
            Staff login
          </Link>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className="md:hidden text-primary p-2 rounded-lg hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
        >
          {menuOpen ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
        </button>
      </div>

      {menuOpen && (
        <nav
          ref={menuRef}
          id="mobile-nav"
          className="md:hidden border-t border-border bg-card flex flex-col"
          aria-label="Mobile"
        >
          {NAV_LINKS.map(({ href, label, ...rest }) => {
            const match = "match" in rest ? rest.match : undefined;
            const active = isNavActive(href, pathname, match);
            return (
              <Link
                key={href}
                href={href}
                className={cn("px-4 border-b border-border", navLinkClass(active))}
                aria-current={active ? "page" : undefined}
              >
                {label}
              </Link>
            );
          })}
          <Link
            href="/checkin"
            className="px-4 py-3 text-body-md font-semibold text-primary border-b border-border min-h-[44px] flex items-center"
          >
            I&apos;m here
          </Link>
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

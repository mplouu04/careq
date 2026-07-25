"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

const PATIENT_NAV_LINKS = [
  { href: "/visit", label: "Check in" },
  { href: "/appointments", label: "Book" },
  { href: "/my-appointments", label: "My appointments" },
  { href: "/status", label: "Queue status" },
] as const;

const MARKETING_NAV_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#contact", label: "Contact" },
] as const;

function isPatientNavActive(href: string, pathname: string): boolean {
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
  const isLanding = pathname === "/";
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeHash, setActiveHash] = useState("");

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!isLanding) return;

    document.documentElement.style.scrollBehavior = "smooth";

    const sectionIds = MARKETING_NAV_LINKS.map((l) => l.href.slice(1));
    const elements = sectionIds
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (elements.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target?.id) {
          setActiveHash(`#${visible[0].target.id}`);
        }
      },
      { rootMargin: "-20% 0px -55% 0px", threshold: [0, 0.25, 0.5] }
    );

    elements.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      document.documentElement.style.scrollBehavior = "";
    };
  }, [isLanding]);

  const marketingLinkClass = (href: string) =>
    cn(
      "text-sm font-medium transition-colors duration-150 py-2 md:py-0 md:pb-1 min-h-[44px] md:min-h-0 flex items-center cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 focus-visible:outline-offset-2 rounded-sm",
      activeHash === href
        ? "text-blue-600 font-semibold md:border-b-2 md:border-blue-600"
        : "text-[#6B7280] hover:text-blue-600"
    );

  const patientLinkClass = (href: string) =>
    cn(
      "text-body-sm md:text-body-md font-medium transition-colors py-2 md:py-0 md:pb-1 min-h-[44px] md:min-h-0 flex items-center",
      isPatientNavActive(href, pathname)
        ? "text-primary font-bold md:border-b-2 md:border-primary"
        : "text-on-surface-variant hover:text-primary"
    );

  if (isLanding) {
    return (
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-[#E2E5EA] font-inter">
        <div className="max-w-[1140px] mx-auto px-6 grid grid-cols-[1fr_auto] lg:grid-cols-[1fr_auto_1fr] items-center min-h-16 gap-4">
          <Link
            href="/"
            className="text-xl font-extrabold text-[#111827] shrink-0 justify-self-start focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 focus-visible:outline-offset-2 rounded-sm"
          >
            CAREQ
          </Link>

          <nav
            className="hidden lg:flex items-center justify-center gap-8"
            aria-label="Main"
          >
            {MARKETING_NAV_LINKS.map(({ href, label }) => (
              <a key={href} href={href} className={marketingLinkClass(href)}>
                {label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3 shrink-0 justify-self-end">
            <div className="hidden sm:flex items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center justify-center min-h-[44px] h-11 px-4 rounded-lg text-sm font-semibold text-blue-600 border border-[#E2E5EA] hover:bg-[#F8F9FB] hover:-translate-y-0.5 active:translate-y-0 transition-all duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 focus-visible:outline-offset-2"
              >
                Staff Login
              </Link>
              <Link
                href="/visit"
                className="inline-flex items-center justify-center min-h-[44px] h-11 px-5 rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 transition-all duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 focus-visible:outline-offset-2"
              >
                Get Started
              </Link>
            </div>
            <button
              type="button"
              className="lg:hidden text-[#111827] p-2 rounded-lg hover:bg-[#F8F9FB] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600"
              onClick={() => setMenuOpen((o) => !o)}
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
            >
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        <nav
          className={cn(
            "lg:hidden border-t border-[#E2E5EA] bg-white flex flex-col overflow-hidden transition-all duration-200 ease-out",
            menuOpen ? "max-h-[420px] opacity-100" : "max-h-0 opacity-0 border-t-0"
          )}
          aria-label="Mobile"
          aria-hidden={!menuOpen}
        >
          {MARKETING_NAV_LINKS.map(({ href, label }) => (
            <a
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className={cn("px-6 border-b border-[#E2E5EA]", marketingLinkClass(href))}
            >
              {label}
            </a>
          ))}
          <Link
            href="/login"
            className="px-6 py-3 text-sm font-medium text-[#6B7280] hover:text-blue-600 border-b border-[#E2E5EA] min-h-[44px] flex items-center cursor-pointer"
          >
            Staff Login
          </Link>
          <Link
            href="/visit"
            className="mx-6 my-3 inline-flex items-center justify-center min-h-[44px] rounded-lg text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors cursor-pointer"
          >
            Get Started
          </Link>
        </nav>
      </header>
    );
  }

  return (
    <header className="careq-navbar sticky top-0 z-50">
      <div className="max-w-careq mx-auto px-margin-mobile md:px-margin-desktop flex items-center justify-between min-h-16 h-auto md:h-16 py-2 md:py-0 gap-2">
        <div className="flex items-center gap-md md:gap-lg min-w-0 flex-1">
          <Link href="/" className="text-headline-md font-bold text-primary shrink-0">
            CAREQ
          </Link>
          <nav
            className="hidden lg:flex items-center gap-md xl:gap-lg"
            aria-label="Main"
          >
            {PATIENT_NAV_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className={patientLinkClass(href)}>
                {label}
              </Link>
            ))}
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
          className="lg:hidden text-primary p-2 rounded-lg hover:bg-muted transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </div>

      {menuOpen && (
        <nav
          className="lg:hidden border-t border-border bg-card flex flex-col"
          aria-label="Mobile"
        >
          {PATIENT_NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={cn("px-4 border-b border-border", patientLinkClass(href))}
            >
              {label}
            </Link>
          ))}
          <Link
            href="/queue"
            className="px-4 py-3 text-body-md text-on-surface-variant hover:text-primary border-b border-border min-h-[44px] flex items-center"
          >
            Queue board (display)
          </Link>
          <Link
            href="/login"
            className="px-4 py-3 text-body-md text-on-surface-variant hover:text-primary min-h-[44px] flex items-center"
          >
            Staff login
          </Link>
        </nav>
      )}
    </header>
  );
}

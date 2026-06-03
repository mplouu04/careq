"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

export function PublicHeader() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  // Close on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <nav className="careq-navbar sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="text-xl font-bold text-white">
          CAREQ
        </Link>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-4">
          <Link
            href="/queue"
            target="_blank"
            className="text-white/80 hover:text-white text-sm font-medium transition-colors"
          >
            Queue Board
          </Link>
          <Link
            href="/login"
            className="text-white border border-white/40 hover:bg-white/10 rounded px-3 py-1 text-sm font-medium transition-colors"
          >
            Staff Login
          </Link>
        </div>

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

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden bg-[#0b5ed7] border-t border-white/10 flex flex-col">
          <Link
            href="/queue"
            target="_blank"
            className="px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors border-b border-white/10"
          >
            Queue Board
          </Link>
          <Link
            href="/login"
            className="px-4 py-3 text-white/90 hover:text-white hover:bg-white/10 text-sm font-medium transition-colors"
          >
            Staff Login
          </Link>
        </div>
      )}
    </nav>
  );
}

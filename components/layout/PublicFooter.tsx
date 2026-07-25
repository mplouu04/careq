"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PublicFooter() {
  const pathname = usePathname();
  const year = new Date().getFullYear();
  const isLanding = pathname === "/";

  if (isLanding) {
    return (
      <footer className="w-full bg-[#111827] text-white font-inter">
        <div className="max-w-[1140px] mx-auto px-6 py-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
            <div className="space-y-3">
              <p className="text-xl font-extrabold tracking-tight">CAREQ</p>
              <p className="text-sm text-[#6B7280] leading-relaxed max-w-xs">
                Queue management built for Philippine clinics
              </p>
            </div>

            <div>
              <p className="text-sm font-semibold text-white mb-4">Product</p>
              <ul className="space-y-3 text-sm text-[#6B7280]">
                <li>
                  <a href="#features" className="hover:text-white transition-colors duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 rounded-sm">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-white transition-colors duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 rounded-sm">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="hover:text-white transition-colors duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 rounded-sm">
                    How It Works
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold text-white mb-4">Company</p>
              <ul className="space-y-3 text-sm text-[#6B7280]">
                <li>
                  <Link href="/login" className="hover:text-white transition-colors duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 rounded-sm">
                    Staff Login
                  </Link>
                </li>
                <li>
                  <a
                    href="#contact"
                    className="hover:text-white transition-colors duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 rounded-sm"
                    aria-label="Privacy Policy — contact us for details"
                  >
                    Privacy Policy
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-sm font-semibold text-white mb-4">Contact</p>
              <ul className="space-y-3 text-sm text-[#6B7280]">
                <li>
                  <a
                    href="mailto:support@careq.ph"
                    className="hover:text-white transition-colors duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 rounded-sm"
                  >
                    support@careq.ph
                  </a>
                </li>
                <li>
                  <a href="#contact" className="hover:text-white transition-colors duration-150 cursor-pointer focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-blue-600 rounded-sm">
                    Get in touch
                  </a>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-[1140px] mx-auto px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-2 text-sm text-[#6B7280]">
            <p>© {year} CAREQ. All rights reserved.</p>
            <p>Built in the Philippines 🇵🇭</p>
          </div>
        </div>
      </footer>
    );
  }

  return (
    <footer className="w-full py-6 px-margin-mobile md:px-margin-desktop flex flex-col md:flex-row justify-between items-center gap-4 border-t border-outline-variant bg-surface-container-lowest">
      <div className="flex flex-col md:flex-row items-center gap-4 md:gap-8">
        <span className="text-label-md font-bold text-on-surface">CAREQ</span>
        <p className="text-body-sm text-on-surface-variant">
          © {year} CAREQ Queue Management System
        </p>
      </div>
      <div className="flex gap-6">
        <Link
          href="/status"
          className="text-body-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          Live Updates
        </Link>
        <Link
          href="/visit"
          className="text-body-sm text-on-surface-variant hover:text-primary transition-colors"
        >
          Check in
        </Link>
      </div>
    </footer>
  );
}

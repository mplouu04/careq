import Link from "next/link";

export function PublicFooter() {
  const year = new Date().getFullYear();

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

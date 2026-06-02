import Link from "next/link";

export function PublicHeader() {
  return (
    <nav className="careq-navbar sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="text-xl font-bold text-white">
          CAREQ
        </Link>
        <div className="flex items-center gap-4">
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
      </div>
    </nav>
  );
}

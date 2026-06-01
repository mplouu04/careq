import Link from "next/link";
import { Button } from "@/components/ui/button";

export function PublicHeader() {
  return (
    <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-50">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <Link href="/" className="text-xl font-bold text-primary">
          CAREQ
        </Link>
        <nav className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/queue" target="_blank">Queue Board</Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">Staff Login</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}

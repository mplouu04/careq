import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { LoginForm } from "@/components/staff/LoginForm";
import { CareqCard } from "@/components/careq";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="px-margin-mobile md:px-margin-desktop py-5 flex items-center justify-between max-w-careq mx-auto w-full">
        <Link href="/" className="text-headline-md font-bold text-primary">
          CAREQ
        </Link>
        <Link
          href="/"
          className="text-body-sm text-on-surface-variant hover:text-primary flex items-center gap-1 min-h-[44px]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Home
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-margin-mobile md:px-margin-desktop pb-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-headline-lg font-bold text-on-surface tracking-tight">
              Staff portal
            </h1>
            <p className="text-body-md text-on-surface-variant mt-2">
              Sign in to manage today&apos;s queue
            </p>
          </div>
          <CareqCard className="p-6 md:p-8 border-t-4 border-t-primary">
            <Suspense fallback={<p className="text-center text-muted-foreground">Loading...</p>}>
              <LoginForm />
            </Suspense>
          </CareqCard>
          <p className="text-center text-body-sm text-on-surface-variant mt-6">
            <Link href="/" className="hover:text-primary underline-offset-2 hover:underline">
              Patient check-in
            </Link>
            {" · "}
            <Link href="/queue" className="hover:text-primary underline-offset-2 hover:underline">
              Queue board
            </Link>
          </p>
        </div>
      </main>

      <footer className="py-6 text-center text-label-sm text-on-surface-variant border-t border-outline-variant">
        © {new Date().getFullYear()} CAREQ Queue Management
      </footer>
    </div>
  );
}

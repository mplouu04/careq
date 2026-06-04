import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, LogIn } from "lucide-react";
import { LoginForm } from "@/components/staff/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Link
        href="/"
        className="fixed top-5 left-5 flex items-center gap-1 text-on-surface-variant hover:text-primary text-body-sm font-medium transition-colors"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to Home
      </Link>

      <div className="auth-container w-full max-w-md">
        <div className="auth-header-tab">
          <div className="auth-tab-item active flex items-center justify-center gap-2">
            <LogIn className="h-4 w-4 text-primary" aria-hidden />
            Staff Login
          </div>
        </div>

        <div className="auth-body">
          <Suspense fallback={<p className="text-center text-muted-foreground">Loading...</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

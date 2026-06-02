import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/staff/LoginForm";

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{ backgroundColor: "#f8f9fa" }}
    >
      {/* Back to home link */}
      <Link
        href="/"
        className="fixed top-5 left-5 flex items-center gap-1 text-gray-500 hover:text-[#0d6efd] text-sm font-medium transition-colors no-underline"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Home
      </Link>

      <div className="auth-container">
        {/* Auth header tab */}
        <div className="auth-header-tab">
          <div className="auth-tab-item active flex items-center justify-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
            </svg>
            Staff Login
          </div>
        </div>

        <div className="auth-body">
          <Suspense fallback={<p className="text-center text-gray-500">Loading...</p>}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

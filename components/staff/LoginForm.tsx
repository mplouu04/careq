"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Staff login form — matches legacy login.php layout exactly.
 * Self-registration is NOT allowed; only admins can create staff accounts.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/dashboard";
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const fd = new FormData(e.currentTarget);
      const supabase = createClient();
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: fd.get("email") as string,
        password: fd.get("password") as string,
      });
      if (authError) {
        if (authError.message.toLowerCase().includes("invalid")) {
          setError("Password is incorrect or user not found.");
        } else {
          setError(authError.message);
        }
        return;
      }
      router.push(redirect);
      router.refresh();
    } catch (err) {
      setError("Unable to connect. Please check your connection and try again.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={login}>
      {error && (
        <div
          className="mb-4 p-3 rounded text-sm flex items-center gap-2"
          style={{ backgroundColor: "#f8d7da", color: "#842029", border: "1px solid #f5c2c7" }}
        >
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          {error}
        </div>
      )}

      {/* Email */}
      <div className="mb-3">
        <label htmlFor="loginEmail" className="block text-sm font-medium text-gray-700 mb-1">
          Email Address
        </label>
        <input
          id="loginEmail"
          name="email"
          type="email"
          required
          autoComplete="email"
          className="careq-input"
          placeholder="you@example.com"
        />
      </div>

      {/* Password */}
      <div className="mb-3">
        <label htmlFor="loginPassword" className="block text-sm font-medium text-gray-700 mb-1">
          Password
        </label>
        <div className="flex">
          <input
            id="loginPassword"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            className="careq-input"
            style={{ borderTopRightRadius: 0, borderBottomRightRadius: 0, borderRight: "none" }}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="px-3 border border-gray-300 rounded-r-lg bg-white text-gray-500 hover:bg-gray-50 transition-colors text-sm"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 rounded-lg font-medium text-white transition-colors mt-2"
        style={{
          backgroundColor: loading ? "#6c757d" : "#0d6efd",
          cursor: loading ? "not-allowed" : "pointer",
        }}
      >
        <span className="flex items-center justify-center gap-2">
          {loading ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Signing in...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
              Login
            </>
          )}
        </span>
      </button>

      <p className="text-center text-sm text-gray-500 mt-4">
        New staff account?{" "}
        <span className="font-medium text-gray-600">Contact your clinic administrator.</span>
      </p>
    </form>
  );
}

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Eye, EyeOff, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { CareqButton, FormLabel, FormInput, FormError } from "@/components/careq";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Staff login — self-registration is not allowed; only admins create staff accounts.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectRaw = searchParams.get("redirect") ?? "/dashboard";
  const ALLOWED_PREFIXES = ["/dashboard", "/admin"];
  const redirect = ALLOWED_PREFIXES.some((p) => redirectRaw.startsWith(p))
    ? redirectRaw
    : "/dashboard";
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
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
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

      const user = authData.user;
      if (!user) {
        setError("Password is incorrect or user not found.");
        return;
      }

      const metadataInactive = user.app_metadata?.staff_active === false;
      const { data: staffRow } = await supabase
        .from("staff")
        .select("is_active")
        .eq("id", user.id)
        .maybeSingle<{ is_active: boolean }>();

      if (metadataInactive || staffRow?.is_active === false) {
        await supabase.auth.signOut();
        setError("Your account has been deactivated. Contact your clinic administrator.");
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
    <form onSubmit={login} className="space-y-4">
      {error && <FormError message={error} />}

      <div>
        <FormLabel htmlFor="loginEmail">Email Address</FormLabel>
        <FormInput
          id="loginEmail"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@clinic.com"
          aria-describedby={error ? "login-error" : undefined}
        />
      </div>

      <div>
        <FormLabel htmlFor="loginPassword">Password</FormLabel>
        <div className="flex">
          <FormInput
            id="loginPassword"
            name="password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            className="rounded-r-none border-r-0"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowPassword((v) => !v)}
            className={cn("h-11 rounded-l-none px-3 shrink-0")}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <label className="flex items-center gap-2 text-body-sm text-on-surface-variant cursor-pointer min-h-[44px]">
        <input
          type="checkbox"
          name="remember"
          className="h-4 w-4 rounded border-input text-primary focus:ring-ring"
        />
        Keep me signed in on this device
      </label>

      <CareqButton type="submit" disabled={loading} className="w-full min-h-[44px]">
        {loading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          <>
            <LogIn className="h-4 w-4" />
            Login
          </>
        )}
      </CareqButton>

      <p className="text-center text-body-sm text-on-surface-variant">
        New staff account?{" "}
        <span className="font-medium text-foreground">Contact your clinic administrator.</span>
      </p>
    </form>
  );
}

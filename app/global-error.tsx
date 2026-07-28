"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";
import { CAREQ_PRIMARY } from "@/lib/design-tokens";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center p-6 font-sans bg-background text-foreground antialiased">
        <div className="max-w-md w-full text-center space-y-4 rounded-xl border border-outline-variant bg-surface-container-lowest shadow-sm p-8">
          <h1 className="text-headline-sm text-on-surface">Something went wrong</h1>
          <p className="text-body-sm text-on-surface-variant">
            An unexpected error occurred. Please refresh the page or try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex items-center justify-center min-h-11 rounded-lg px-4 py-2 text-body-sm font-medium text-white transition-colors"
            style={{ backgroundColor: CAREQ_PRIMARY }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

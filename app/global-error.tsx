"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

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
      <body className="min-h-screen flex items-center justify-center p-6 font-sans">
        <div className="max-w-md text-center space-y-4">
          <h1 className="text-xl font-semibold">Something went wrong</h1>
          <p className="text-sm text-gray-600">
            An unexpected error occurred. Please refresh the page or try again.
          </p>
          <button
            type="button"
            onClick={() => reset()}
            className="rounded-lg bg-black text-white px-4 py-2 text-sm"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}

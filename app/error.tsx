"use client";

import { useEffect } from "react";
import { CareqButton } from "@/components/careq";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Global Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="careq-card p-8">
          <h2 className="text-headline-sm text-foreground mb-2">Something went wrong</h2>
          <p className="text-body-sm text-muted-foreground mb-6">
            An unexpected error occurred. Please try again or return to the home page.
          </p>
          <div className="flex gap-3 justify-center">
            <CareqButton type="button" onClick={reset}>
              Try again
            </CareqButton>
            <Button variant="outline" asChild>
              <a href="/">Go home</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

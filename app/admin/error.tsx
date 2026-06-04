"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CareqButton } from "@/components/careq";
import { Button } from "@/components/ui/button";

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Admin Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="careq-card p-8">
          <h2 className="text-headline-sm text-foreground mb-2">Admin panel error</h2>
          <p className="text-body-sm text-muted-foreground mb-6">
            Failed to load the admin panel. Please try again or return to the dashboard.
          </p>
          <div className="flex gap-3 justify-center">
            <CareqButton type="button" onClick={reset}>
              Try again
            </CareqButton>
            <Button variant="outline" asChild>
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

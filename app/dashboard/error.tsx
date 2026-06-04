"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CareqButton } from "@/components/careq";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="careq-card p-8">
          <h2 className="text-headline-sm text-foreground mb-2">Dashboard error</h2>
          <p className="text-body-sm text-muted-foreground mb-6">
            Failed to load the dashboard. Please try again or contact support.
          </p>
          <div className="flex gap-3 justify-center">
            <CareqButton type="button" onClick={reset}>
              Try again
            </CareqButton>
            <Button variant="outline" asChild>
              <Link href="/login">Back to login</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

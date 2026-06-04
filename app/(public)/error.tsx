"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CareqButton } from "@/components/careq";
import { Button } from "@/components/ui/button";

export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Public Error]", error);
  }, [error]);

  return (
    <div className="max-w-md mx-auto px-4 py-16">
      <div className="careq-card p-8 text-center">
        <h2 className="text-headline-sm text-foreground mb-2">Something went wrong</h2>
        <p className="text-body-sm text-muted-foreground mb-6">
          An error occurred while loading this page. Please try again.
        </p>
        <div className="flex gap-3 justify-center">
          <CareqButton type="button" onClick={reset}>
            Try again
          </CareqButton>
          <Button variant="outline" asChild>
            <Link href="/">Go home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

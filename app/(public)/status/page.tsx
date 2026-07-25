"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";
import { CareqPage, CareqCard, CareqButton, PageHeader, FormPageSkeleton } from "@/components/careq";
import { FormLabel, FormInput } from "@/components/careq";

function StatusLookupInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [ref, setRef] = useState("");

  useEffect(() => {
    const q = searchParams.get("queue") ?? searchParams.get("ref") ?? "";
    if (q) {
      setRef(q.toUpperCase());
      router.push(`/status/${encodeURIComponent(q.toUpperCase())}`);
    }
  }, [searchParams, router]);

  function go() {
    const trimmed = ref.trim().toUpperCase();
    if (trimmed) {
      router.push(`/status/${encodeURIComponent(trimmed)}`);
    }
  }

  return (
    <CareqPage narrow>
      <PageHeader
        title="Track your queue"
        subtitle="Enter your queue or appointment reference from check-in"
        backHref="/"
      />
      <CareqCard className="p-6 md:p-8">
        <div className="flex justify-center mb-6">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Search className="h-7 w-7" aria-hidden />
          </div>
        </div>
        <div className="space-y-4 max-w-sm mx-auto">
          <div>
            <FormLabel htmlFor="queue-ref">Reference number</FormLabel>
            <FormInput
              id="queue-ref"
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && go()}
              placeholder="WALK-5 or APPT-12"
              maxLength={20}
              className="text-center text-xl font-mono tracking-wider h-12 mt-1"
              autoComplete="off"
            />
            <p className="text-body-sm text-on-surface-variant mt-2 text-center">
              Shown on your check-in confirmation
            </p>
          </div>
          <CareqButton onClick={go} disabled={!ref.trim()} className="w-full min-h-[44px]">
            View live status
          </CareqButton>
        </div>
      </CareqCard>
    </CareqPage>
  );
}

export default function StatusLookupPage() {
  return (
    <Suspense
      fallback={
        <CareqPage narrow>
          <FormPageSkeleton />
        </CareqPage>
      }
    >
      <StatusLookupInner />
    </Suspense>
  );
}

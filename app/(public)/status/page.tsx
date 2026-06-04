"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock } from "lucide-react";
import { CareqPage, CareqCard, CareqButton, PageHeader } from "@/components/careq";
import { FormInput } from "@/components/careq";

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
        title="My Queue Status"
        subtitle="Enter your queue or appointment reference number"
        backHref="/"
      />
      <CareqCard className="p-8">
        <div className="text-center mb-6">
          <Clock className="w-12 h-12 text-primary mx-auto mb-3" aria-hidden />
        </div>
        <div className="space-y-3">
          <FormInput
            type="text"
            value={ref}
            onChange={(e) => setRef(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && go()}
            placeholder="e.g. APPT-1 or WALK-2"
            maxLength={20}
            className="text-center text-lg font-medium tracking-wider"
          />
          <CareqButton onClick={go} disabled={!ref.trim()} className="w-full">
            Check Status
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
          <p className="text-center text-muted-foreground py-10">Loading...</p>
        </CareqPage>
      }
    >
      <StatusLookupInner />
    </Suspense>
  );
}

"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

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
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="max-w-md mx-auto">
        <div className="careq-card shadow p-8">
          <div className="text-center mb-6">
            <svg className="w-12 h-12 text-[#0d6efd] mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h1 className="text-2xl font-bold text-gray-800">My Queue Status</h1>
            <p className="text-gray-500 text-sm mt-1">
              Enter your queue or appointment reference number
            </p>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={ref}
              onChange={(e) => setRef(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && go()}
              placeholder="e.g. APPT-1 or WALK-2"
              maxLength={20}
              className="careq-input text-center text-lg font-medium tracking-wider"
            />
            <button
              onClick={go}
              disabled={!ref.trim()}
              className="w-full py-3 rounded-lg font-medium text-white transition-colors"
              style={{
                backgroundColor: !ref.trim() ? "#6c757d" : "#0d6efd",
                cursor: !ref.trim() ? "not-allowed" : "pointer",
              }}
            >
              Check Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function StatusLookupPage() {
  return (
    <Suspense fallback={<p className="text-center text-gray-500 py-10">Loading...</p>}>
      <StatusLookupInner />
    </Suspense>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function StatusLookupPage() {
  const [ref, setRef] = useState("");
  const router = useRouter();

  function go() {
    if (ref.trim()) router.push(`/status/${encodeURIComponent(ref.trim())}`);
  }

  return (
    <div className="max-w-md mx-auto space-y-6">
      <h1 className="text-3xl font-bold">My Queue Status</h1>
      <p className="text-muted-foreground">
        Enter your queue number (e.g. WALK-5) or appointment reference.
      </p>
      <div>
        <Label>Queue / Reference Number</Label>
        <Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="WALK-1 or APPT..." />
      </div>
      <Button onClick={go} className="w-full">
        Track Status
      </Button>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search } from "lucide-react";
import { CareqCard, CareqButton, FormLabel, FormInput, FormInfo } from "@/components/careq";

export function PatientLookupInline() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    if (!phone.trim() || !dob) {
      setError("Enter phone and date of birth to find your profile.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/appointments?${new URLSearchParams({ phone, dob })}`
      );
      const data = res.ok ? await res.json() : {};
      if (!data.patientId) {
        setError("No profile found. Search or register first.");
        return;
      }
      router.replace(`/appointments?patientId=${data.patientId}`, { scroll: false });
    } catch {
      setError("Lookup failed. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <CareqCard className="p-5 mb-4 border-primary/30 bg-primary/5">
      <h3 className="text-headline-sm text-on-surface mb-1">Find your profile first</h3>
      <p className="text-body-sm text-on-surface-variant mb-4">
        Bookings are linked to your patient record. Search by phone and date of birth, or{" "}
        <Link href="/patient-search" className="text-primary font-medium hover:underline">
          use full search
        </Link>
        .
      </p>
      <form onSubmit={lookup} className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <FormLabel htmlFor="book-phone">Phone</FormLabel>
            <FormInput
              id="book-phone"
              type="tel"
              inputMode="tel"
              placeholder="09XXXXXXXXX"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              required
            />
          </div>
          <div>
            <FormLabel htmlFor="book-dob">Date of birth</FormLabel>
            <FormInput
              id="book-dob"
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              required
            />
          </div>
        </div>
        {error && <p className="text-body-sm text-destructive">{error}</p>}
        <CareqButton type="submit" disabled={loading} className="w-full sm:w-auto">
          <Search className="h-4 w-4" />
          {loading ? "Looking up..." : "Continue to booking"}
        </CareqButton>
      </form>
      <div className="mt-3">
        <FormInfo>
          New here?{" "}
          <Link href="/registration" className="text-primary font-medium hover:underline">
            Register
          </Link>{" "}
          first, then return to book.
        </FormInfo>
      </div>
    </CareqCard>
  );
}

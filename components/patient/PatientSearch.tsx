"use client";

import { useState } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Patient = {
  id: number;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  phone: string;
};

export function PatientSearch() {
  const [q, setQ] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);

  async function search() {
    if (q.length < 2) return;
    setLoading(true);
    const res = await fetch(`/api/patients?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setPatients(data.patients ?? []);
    setLoading(false);
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex gap-2">
        <Input
          placeholder="Search by name or phone..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <Button onClick={search} disabled={loading}>
          Search
        </Button>
      </div>
      <div className="space-y-2">
        {patients.map((p) => (
          <Card key={p.id}>
            <CardContent className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium">
                  {p.first_name} {p.last_name}
                </p>
                <p className="text-sm text-muted-foreground">{p.phone}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/appointments?patientId=${p.id}`}>Book</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link href={`/checkin?type=walk-in&patientId=${p.id}`}>
                    Check In
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Button variant="link" asChild>
        <Link href="/registration">Register new patient</Link>
      </Button>
    </div>
  );
}

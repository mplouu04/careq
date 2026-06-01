import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Footprints } from "lucide-react";

export default function VisitPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">How are you visiting today?</h1>
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="hover:border-primary transition-colors">
          <CardHeader>
            <Footprints className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Walk-In</CardTitle>
            <CardDescription>I arrived without an appointment</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" asChild>
              <Link href="/checkin?type=walk-in">Continue as Walk-In</Link>
            </Button>
          </CardContent>
        </Card>
        <Card className="hover:border-primary transition-colors">
          <CardHeader>
            <Calendar className="h-10 w-10 text-primary mb-2" />
            <CardTitle>Appointment</CardTitle>
            <CardDescription>I have a scheduled appointment</CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" variant="outline" asChild>
              <Link href="/checkin?type=appointment">Check In with Reference</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

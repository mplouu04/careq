import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  CalendarCheck,
  CalendarPlus,
  Clock,
  LogIn,
  UserCheck,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-8rem)]">
      <div className="space-y-6">
        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900">
          CAREQ
        </h1>
        <p className="text-lg text-slate-600 max-w-lg">
          Streamline patient flow, reduce wait times, and improve clinic
          efficiency with our digital queue management solution.
        </p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" asChild>
            <Link href="/visit">
              <UserCheck className="mr-2 h-5 w-5" />
              Patient Check-In
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/patient-search">
              <CalendarPlus className="mr-2 h-5 w-5" />
              Book Appointment
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/status">
              <Clock className="mr-2 h-5 w-5" />
              My Queue Status
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/my-appointments">
              <CalendarCheck className="mr-2 h-5 w-5" />
              My Appointments
            </Link>
          </Button>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/login">
              <LogIn className="mr-2 h-5 w-5" />
              Staff Login
            </Link>
          </Button>
        </div>
      </div>
      <div className="hidden lg:flex items-center justify-center">
        <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 p-12 text-white shadow-xl w-full max-w-md aspect-square flex flex-col justify-center">
          <p className="text-3xl font-semibold">Queue smarter.</p>
          <p className="mt-4 text-blue-100">
            Real-time updates for patients and staff. No more crowded waiting
            rooms.
          </p>
        </div>
      </div>
    </div>
  );
}

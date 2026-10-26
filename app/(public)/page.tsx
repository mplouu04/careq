import { PatientHub } from "@/components/patient/PatientHub";
import { CareqButton } from "@/components/careq";
import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <PatientHub />

      <div
        className="fixed bottom-0 left-0 right-0 z-40 md:hidden border-t border-outline-variant bg-surface/95 backdrop-blur-md p-3 safe-area-pb"
        role="region"
        aria-label="Quick actions"
      >
        <div className="grid grid-cols-2 gap-2 max-w-careq mx-auto">
          <CareqButton asChild className="w-full" size="lg" variant="outline">
            <Link href="/patient-search?intent=book">Book</Link>
          </CareqButton>
          <CareqButton asChild className="w-full" size="lg">
            <Link href="/checkin">I&apos;m here</Link>
          </CareqButton>
        </div>
      </div>
      <div className="h-20 md:hidden" aria-hidden />
    </>
  );
}

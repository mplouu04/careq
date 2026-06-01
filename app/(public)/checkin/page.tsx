import { Suspense } from "react";
import { CheckinForm } from "@/components/patient/CheckinForm";

export default function CheckinPage() {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Patient Check-In</h1>
      <Suspense fallback={<p>Loading...</p>}>
        <CheckinForm />
      </Suspense>
    </div>
  );
}

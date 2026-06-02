import Link from "next/link";
import { RegistrationForm } from "@/components/patient/RegistrationForm";

export default function RegistrationPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="max-w-lg mx-auto space-y-5">
        <div>
          <Link
            href="/visit"
            className="inline-flex items-center gap-1 text-gray-500 hover:text-[#0d6efd] text-sm mb-4 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </Link>
          <h1 className="text-3xl font-bold text-gray-800">New Patient Registration</h1>
          <p className="text-gray-500 text-sm mt-1">
            Already registered?{" "}
            <Link href="/patient-search" className="text-[#0d6efd] hover:underline">
              Find your profile
            </Link>
          </p>
        </div>
        <RegistrationForm />
      </div>
    </div>
  );
}

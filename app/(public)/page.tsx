import Link from "next/link";
import Image from "next/image";

export default function HomePage() {
  return (
    <div className="landing-page">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center min-h-[calc(100vh-3.5rem)]">
          {/* Left column */}
          <div className="w-full md:w-1/2 py-12 text-center md:text-left">
            <h1 className="text-5xl font-bold mb-3 text-gray-800">CAREQ</h1>
            <p className="text-lg text-gray-600 mb-8 max-w-lg mx-auto md:mx-0">
              Streamline patient flow, reduce wait times, and improve clinic
              efficiency with our digital queue management solution.
            </p>
            <div className="flex flex-wrap gap-3 justify-center md:justify-start">
              <Link
                href="/visit"
                className="inline-flex items-center gap-2 bg-[#0d6efd] hover:bg-[#0b5ed7] text-white font-medium px-6 py-3 rounded-lg text-base transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Patient Check-In
              </Link>
              <Link
                href="/patient-search"
                className="inline-flex items-center gap-2 border border-[#0d6efd] text-[#0d6efd] hover:bg-[#0d6efd] hover:text-white font-medium px-6 py-3 rounded-lg text-base transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Book Appointment
              </Link>
              <Link
                href="/status"
                className="inline-flex items-center gap-2 border border-gray-400 text-gray-600 hover:bg-gray-200 font-medium px-6 py-3 rounded-lg text-base transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                My Queue Status
              </Link>
              <Link
                href="/my-appointments"
                className="inline-flex items-center gap-2 border border-gray-400 text-gray-600 hover:bg-gray-200 font-medium px-6 py-3 rounded-lg text-base transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                My Appointments
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-white hover:bg-gray-100 text-gray-700 border border-gray-300 font-medium px-6 py-3 rounded-lg text-base transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Staff Login
              </Link>
            </div>
          </div>

          {/* Right column — image */}
          <div className="hidden md:flex w-1/2 items-center justify-center py-12 pl-8">
            <Image
              src="/images/profile.png"
              alt="Patients waiting in clinic queue with mobile phones"
              width={500}
              height={400}
              className="rounded-xl shadow-lg object-cover"
              priority
            />
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";

export default function VisitPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="flex justify-center">
        <div className="w-full max-w-lg">
          <div className="careq-card shadow-md">
            <div className="p-10 text-center">
              {/* Question icon */}
              <div className="mb-6">
                <svg
                  className="w-16 h-16 text-[#0d6efd] mx-auto mb-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <h3 className="text-2xl font-bold mb-2 text-gray-800">
                  Have you been here before, or is this your first visit?
                </h3>
                <p className="text-gray-500">Please select one of the options below</p>
              </div>

              {/* Buttons */}
              <div className="flex flex-col gap-3 max-w-xs mx-auto">
                <Link
                  href="/patient-search"
                  className="flex items-center justify-center gap-2 bg-[#0d6efd] hover:bg-[#0b5ed7] text-white font-medium px-6 py-3 rounded-lg text-base transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Yes, I&apos;ve been here before
                </Link>
                <Link
                  href="/registration"
                  className="flex items-center justify-center gap-2 border border-[#0d6efd] text-[#0d6efd] hover:bg-[#0d6efd] hover:text-white font-medium px-6 py-3 rounded-lg text-base transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  No, this is my first visit
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

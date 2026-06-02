import { PatientSearch } from "@/components/patient/PatientSearch";

export default function PatientSearchPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <div className="space-y-4">
        <h1 className="text-3xl font-bold text-gray-800">Find Your Profile</h1>
        <p className="text-gray-500">
          Search for an existing patient to book an appointment or check in.
        </p>
        <PatientSearch />
      </div>
    </div>
  );
}

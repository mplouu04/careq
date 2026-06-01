import { PatientSearch } from "@/components/patient/PatientSearch";

export default function PatientSearchPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Find Patient</h1>
      <p className="text-muted-foreground">
        Search for an existing patient to book an appointment or check in.
      </p>
      <PatientSearch />
    </div>
  );
}

import { RegistrationForm } from "@/components/patient/RegistrationForm";

export default function RegistrationPage() {
  return (
    <div className="max-w-lg mx-auto space-y-6">
      <h1 className="text-3xl font-bold">New Patient Registration</h1>
      <RegistrationForm />
    </div>
  );
}

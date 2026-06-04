import Link from "next/link";
import { RegistrationForm } from "@/components/patient/RegistrationForm";
import { CareqPage, PageHeader } from "@/components/careq";

export default function RegistrationPage() {
  return (
    <CareqPage narrow>
      <PageHeader
        title="New Patient Registration"
        subtitle={
          <>
            Already registered?{" "}
            <Link href="/patient-search" className="text-primary hover:underline font-medium">
              Find your profile
            </Link>
          </>
        }
        backHref="/visit"
      />
      <RegistrationForm />
    </CareqPage>
  );
}

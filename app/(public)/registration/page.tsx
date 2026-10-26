import Link from "next/link";
import { RegistrationForm } from "@/components/patient/RegistrationForm";
import { PatientFlowBreadcrumb } from "@/components/patient/PatientFlowBreadcrumb";
import { ClinicHelpStrip } from "@/components/patient/ClinicHelpStrip";
import { CareqPage, PageHeader } from "@/components/careq";

type Props = {
  searchParams?: { intent?: string };
};

function resolveRedirect(intent?: string): string | undefined {
  if (intent === "book" || intent === "appointment") return "/appointments";
  if (intent === "checkin" || intent === "walk-in" || intent === "walkin") {
    return "/checkin?tab=walk-in";
  }
  return undefined;
}

export default function RegistrationPage({ searchParams }: Props) {
  const redirectTo = resolveRedirect(searchParams?.intent);
  const findHref = searchParams?.intent
    ? `/patient-search?intent=${encodeURIComponent(searchParams.intent)}`
    : "/patient-search";

  return (
    <CareqPage narrow className="space-y-6">
      <PatientFlowBreadcrumb flow="registration" />
      <PageHeader
        title="New patient registration"
        subtitle={
          <>
            Already registered?{" "}
            <Link href={findHref} className="text-primary hover:underline font-medium">
              Find your profile
            </Link>
          </>
        }
        backHref="/"
      />
      <RegistrationForm redirectTo={redirectTo} />
      <ClinicHelpStrip compact />
    </CareqPage>
  );
}

import { PatientSearch } from "@/components/patient/PatientSearch";
import { ClinicStatusBar } from "@/components/patient/ClinicStatusBar";
import { PatientFlowBreadcrumb } from "@/components/patient/PatientFlowBreadcrumb";
import { CareqPage, PageHeader } from "@/components/careq";

export default function PatientSearchPage() {
  return (
    <CareqPage className="pb-10">
      <div className="max-w-3xl mx-auto">
        <PatientFlowBreadcrumb flow="search" />
        <PageHeader
          title="Find your profile"
          subtitle={
            <>
              <span className="block font-medium text-on-surface mb-1">
                Step 2 · Search before check-in or booking
              </span>
              Returning patients: search below to check in for today&apos;s visit or schedule an
              appointment. This is not registration — new patients should use Register.
            </>
          }
          backHref="/visit"
          backLabel="Back to visit options"
        />

        <PatientSearch />

        <section
          className="mt-8"
          aria-labelledby="clinic-snapshot-heading"
        >
          <h2
            id="clinic-snapshot-heading"
            className="text-headline-sm text-on-surface mb-1"
          >
            Clinic right now
          </h2>
          <p className="text-body-sm text-on-surface-variant mb-4">
            Live queue snapshot while you search — useful if you are checking in as a walk-in
            today.
          </p>
          <ClinicStatusBar />
        </section>
      </div>
    </CareqPage>
  );
}

import { VisitChoice } from "@/components/patient/VisitChoice";
import { ClinicStatusBar } from "@/components/patient/ClinicStatusBar";

export default function VisitPage() {
  return (
    <div className="space-y-8">
      <ClinicStatusBar />
      <VisitChoice />
    </div>
  );
}

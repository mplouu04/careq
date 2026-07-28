import { RefreshCw, Smartphone, MessageSquare } from "lucide-react";
import { MarketingSection } from "@/components/layout/MarketingSection";

const FEATURES = [
  {
    icon: RefreshCw,
    title: "Real-time updates",
    description:
      "Dashboard, public board, and patient status stay in sync as staff move the queue.",
    span: "md:col-span-2",
  },
  {
    icon: Smartphone,
    title: "Any device",
    description: "Browser-based for patients and staff—no app store required.",
    span: "",
  },
  {
    icon: MessageSquare,
    title: "Email reminders",
    description:
      "Optional appointment reminders by email help reduce no-shows and lobby crowding.",
    span: "md:col-span-1",
  },
] as const;

export function LandingFeatures() {
  return (
    <MarketingSection variant="muted">
      <div className="mb-xl max-w-2xl">
        <h2 className="text-headline-lg text-on-surface mb-md">
          Operations that stay out of the way
        </h2>
        <p className="text-body-lg text-on-surface-variant">
          Everything your team needs to run the day—without switching tools.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
        {FEATURES.map(({ icon: Icon, title, description, span }) => (
          <div
            key={title}
            className={`rounded-2xl border border-outline-variant bg-surface p-lg hover:shadow-md transition-shadow duration-200 ${span}`}
          >
            <div className="w-11 h-11 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-md">
              <Icon className="h-5 w-5" aria-hidden />
            </div>
            <h3 className="text-headline-sm text-on-surface mb-2">{title}</h3>
            <p className="text-body-md text-on-surface-variant">{description}</p>
          </div>
        ))}
      </div>
    </MarketingSection>
  );
}

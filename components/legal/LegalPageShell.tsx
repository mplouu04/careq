import Link from "next/link";
import { getClinicPublicInfo } from "@/lib/clinic-public";

export function LegalPageShell({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  const clinic = getClinicPublicInfo();

  return (
    <article className="max-w-3xl mx-auto px-margin-mobile md:px-margin-desktop py-xl">
      <p className="text-body-sm text-on-surface-variant mb-2">
        <Link href="/" className="text-primary hover:underline">
          Home
        </Link>
        {" · "}
        <Link href="/privacy" className="text-primary hover:underline">
          Privacy Notice
        </Link>
        {" · "}
        <Link href="/terms" className="text-primary hover:underline">
          Terms of Use
        </Link>
      </p>
      <h1 className="text-headline-lg text-on-surface mb-2">{title}</h1>
      <p className="text-body-sm text-on-surface-variant mb-lg">
        Last updated: {updated}. Applies to {clinic.name}.
      </p>
      <div className="prose-legal space-y-md text-body-md text-on-surface-variant [&_h2]:text-headline-sm [&_h2]:text-on-surface [&_h2]:mt-lg [&_h2]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-primary [&_a]:underline">
        {children}
      </div>
      <p className="mt-xl text-body-sm text-on-surface-variant border-t border-outline-variant pt-md">
        This page is an operational disclosure for CareQ users. It is not a substitute for advice from a
        qualified lawyer or the National Privacy Commission. Have your counsel review and customize it
        for your clinic.
      </p>
    </article>
  );
}

import Link from "next/link";

/** Shared privacy/terms links for patient consent checkboxes. */
export function ConsentLegalLinks({ className }: { className?: string }) {
  return (
    <span className={className}>
      See our{" "}
      <Link href="/privacy" className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
        Privacy Notice
      </Link>{" "}
      and{" "}
      <Link href="/terms" className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">
        Terms of Use
      </Link>
      .
    </span>
  );
}

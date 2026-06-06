import Link from "next/link";
import { cn } from "@/lib/utils";

export function AdminCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#E5E7EB] bg-white p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function AdminCardTitle({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <h3
      className={cn(
        "text-base font-bold text-[#111827] mb-4",
        className
      )}
    >
      {children}
    </h3>
  );
}

export function AdminDangerCard({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-[#FEE2E2] bg-[#FFF5F5] p-5",
        className
      )}
    >
      {children}
    </div>
  );
}

const btnBase =
  "inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50";

export function AdminButton({
  variant = "primary",
  size = "default",
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "danger";
  size?: "default" | "sm";
}) {
  return (
    <button
      type="button"
      className={cn(
        btnBase,
        "rounded-lg",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
        variant === "primary" && "bg-[#2563EB] text-white hover:bg-[#1D4ED8]",
        variant === "outline" &&
          "border border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F9FAFB]",
        variant === "danger" && "bg-[#DC2626] text-white hover:bg-[#B91C1C]",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function AdminButtonLink({
  variant = "outline",
  size = "sm",
  className,
  children,
  href,
  ...props
}: React.ComponentProps<typeof Link> & {
  variant?: "primary" | "outline" | "danger";
  size?: "default" | "sm";
}) {
  return (
    <Link
      href={href}
      className={cn(
        btnBase,
        "rounded-lg",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-1.5 text-sm",
        variant === "primary" && "bg-[#2563EB] text-white hover:bg-[#1D4ED8]",
        variant === "outline" &&
          "border border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F9FAFB]",
        variant === "danger" && "bg-[#DC2626] text-white hover:bg-[#B91C1C]",
        className
      )}
      {...props}
    >
      {children}
    </Link>
  );
}

export function AdminFilterPill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-[#2563EB] text-white"
          : "border border-[#D1D5DB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
      )}
    >
      {children}
    </button>
  );
}

export function AdminStatusBadge({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        active
          ? "bg-[#F0FDF4] text-[#16A34A]"
          : "bg-[#F3F4F6] text-[#6B7280]",
        className
      )}
    >
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export function AdminRolePill({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-sm border border-[#E5E7EB] px-2 py-0.5 text-xs font-medium text-[#374151] capitalize",
        className
      )}
    >
      {children}
    </span>
  );
}

export function AdminStaffAvatar({
  firstName,
  lastName,
}: {
  firstName: string;
  lastName: string;
}) {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#EFF6FF] text-xs font-semibold text-[#2563EB]"
      aria-hidden
    >
      {initials}
    </span>
  );
}

export function AdminLabel({
  children,
  htmlFor,
  className,
}: {
  children: React.ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        "mb-1.5 block text-sm font-medium text-[#374151]",
        className
      )}
    >
      {children}
    </label>
  );
}

export function AdminInput({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-[34px] w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20",
        className
      )}
      {...props}
    />
  );
}

export function AdminSelect({
  className,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-[34px] w-full rounded-lg border border-[#D1D5DB] bg-white px-3 text-sm text-[#111827] focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20",
        className
      )}
      {...props}
    />
  );
}

export function AdminCheckbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 rounded border-[#D1D5DB] accent-[#2563EB]",
        className
      )}
      {...props}
    />
  );
}

export function AdminTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

export function AdminTableHead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-[#F9FAFB]">{children}</tr>
    </thead>
  );
}

export function AdminTh({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "px-3 py-2.5 text-xs font-medium uppercase tracking-[0.04em] text-[#6B7280]",
        className
      )}
    >
      {children}
    </th>
  );
}

export function AdminTableBody({ children }: { children: React.ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function AdminTr({ children }: { children: React.ReactNode }) {
  return (
    <tr className="border-b border-[#E5E7EB] transition-colors hover:bg-[#FAFAFA]">
      {children}
    </tr>
  );
}

export function AdminTd({
  children,
  className,
  colSpan,
}: {
  children: React.ReactNode;
  className?: string;
  colSpan?: number;
}) {
  return (
    <td colSpan={colSpan} className={cn("px-3 py-3 text-[13px] text-[#374151]", className)}>
      {children}
    </td>
  );
}

export function AdminApptStatusBadge({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const isGreen = ["checked_in", "completed", "in_progress"].includes(status);
  const isBlue = status === "pending";
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        isGreen && "bg-[#F0FDF4] text-[#16A34A]",
        isBlue && "bg-[#EFF6FF] text-[#2563EB]",
        !isGreen && !isBlue && "bg-[#F3F4F6] text-[#6B7280]"
      )}
    >
      {label}
    </span>
  );
}

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, Info } from "lucide-react";

export const formInputClass =
  "h-11 min-h-11 px-4 text-body-md rounded-lg bg-background border-input transition-all duration-150 group-focus-within/field:border-primary group-focus-within/field:ring-2 group-focus-within/field:ring-primary/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

/** Field wrapper that enables focus-within halo micro-interaction on FormInput. */
export function FormFieldGroup({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("group/field", className)}>{children}</div>;
}

export function FormLabel({
  htmlFor,
  children,
  required,
}: {
  htmlFor?: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <Label htmlFor={htmlFor} className="text-body-sm font-medium text-on-surface mb-1.5 block">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );
}

export function FormInput({
  className,
  ...props
}: React.ComponentProps<typeof Input>) {
  return <Input className={cn(formInputClass, className)} {...props} />;
}

const selectClass =
  "flex h-11 min-h-11 w-full rounded-lg border border-input bg-background px-4 py-2 text-body-md text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50";

export function FormSelect({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return <select className={cn(selectClass, className)} {...props} />;
}

export function FormHelperText({
  id,
  children,
  className,
}: {
  id?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p
      id={id}
      className={cn("text-body-sm text-on-surface-variant mt-1.5", className)}
    >
      {children}
    </p>
  );
}

export function FormError({ message }: { message: string }) {
  return (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertDescription>{message}</AlertDescription>
    </Alert>
  );
}

export function FormInfo({ message, children }: { message?: string; children?: React.ReactNode }) {
  return (
    <Alert className="mb-4 border-secondary-container bg-secondary-container/50 text-on-secondary-container">
      <Info className="h-4 w-4 text-primary" />
      <AlertDescription className="text-body-sm">
        {children ?? message}
      </AlertDescription>
    </Alert>
  );
}

export function FormWarning({ children }: { children: React.ReactNode }) {
  return (
    <Alert className="mb-4 border-amber-200 bg-amber-50 text-amber-900">
      <AlertCircle className="h-4 w-4 text-amber-600" />
      <AlertDescription className="text-body-sm">{children}</AlertDescription>
    </Alert>
  );
}

export function CareqCardHeader({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-6 py-4 border-b border-border", className)}>
      <h3 className="text-headline-sm text-on-surface">{title}</h3>
      {description && (
        <p className="text-body-sm text-on-surface-variant mt-0.5">{description}</p>
      )}
      {children}
    </div>
  );
}

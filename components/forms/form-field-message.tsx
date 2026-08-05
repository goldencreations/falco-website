import { cn } from "@/lib/utils";

export function FormFieldMessage({ message, className }: { message?: string; className?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className={cn("text-xs text-destructive", className)}>
      {message}
    </p>
  );
}

export function formControlErrorClass(hasError?: boolean) {
  return cn(
    hasError &&
      "border-destructive ring-1 ring-destructive/40 focus-visible:ring-destructive/50 aria-invalid:border-destructive"
  );
}

export function formControlErrorProps(message?: string) {
  if (!message) return {};
  return {
    "aria-invalid": true,
    title: message,
  };
}

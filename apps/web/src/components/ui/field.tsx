import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";

export const inputClass = (invalid?: boolean) => cn(
  "block w-full h-10 rounded-[var(--radius-control)] border bg-white px-3 text-[15px] text-body",
  "placeholder:text-muted/70 transition-colors",
  "focus:outline-none focus:ring-2 focus:ring-ink/15 focus:border-ink",
  "disabled:bg-mist disabled:text-muted",
  invalid ? "border-bad" : "border-line hover:border-steel-light",
);

interface FieldProps extends ComponentProps<"input"> {
  label: string;
  name: string;
  error?: string;
  hint?: ReactNode;
  optional?: boolean;
}

export function Field({ label, name, error, hint, optional, className, id, ...props }: FieldProps) {
  const fieldId = id ?? name;
  const describedBy = [error && `${fieldId}-error`, hint && `${fieldId}-hint`].filter(Boolean).join(" ") || undefined;
  return (
    <div className={className}>
      <Label htmlFor={fieldId} optional={optional}>{label}</Label>
      <input id={fieldId} name={name} aria-invalid={!!error} aria-describedby={describedBy}
        className={inputClass(!!error)} {...props} />
      <FieldMessage id={fieldId} error={error} hint={hint} />
    </div>
  );
}

export function Label({ htmlFor, optional, children }: { htmlFor: string; optional?: boolean; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-ink">
      {children}
      {optional && <span className="text-xs font-normal text-muted">Optional</span>}
    </label>
  );
}

export function FieldMessage({ id, error, hint }: { id: string; error?: string; hint?: ReactNode }) {
  if (error) return <p id={`${id}-error`} className="mt-1.5 text-sm text-bad">{error}</p>;
  if (hint) return <p id={`${id}-hint`} className="mt-1.5 text-sm text-muted">{hint}</p>;
  return null;
}

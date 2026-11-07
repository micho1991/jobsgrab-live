import type { ZodError } from "zod";

export interface FormState {
  error?: string;
  success?: string;
  fieldErrors?: Record<string, string>;
  /** Echo non-secret values back so the form keeps what the user typed */
  values?: Record<string, string>;
}

export const fieldErrors = (e: ZodError): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const issue of e.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
};

export const formValues = (fd: FormData, keys: string[]) =>
  Object.fromEntries(keys.map((k) => [k, String(fd.get(k) ?? "")]));

"use client";
import { useActionState } from "react";
import { resendVerification } from "../actions";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";

export function ResendForm({ email }: { email: string }) {
  const [state, action] = useActionState<FormState, FormData>(resendVerification, {});
  return (
    <form action={action} className="grid gap-3">
      {state.success && <Alert tone="success">{state.success}</Alert>}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {email
        ? <input type="hidden" name="email" value={email} />
        : <Field label="Email" name="email" type="email" autoComplete="email" required error={state.fieldErrors?.email} />}
      <SubmitButton variant="secondary" pendingText="Sending…">Send a new link</SubmitButton>
    </form>
  );
}

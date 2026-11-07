"use client";
import { useActionState } from "react";
import { forgotPassword } from "../actions";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";

export function ForgotForm() {
  const [state, action] = useActionState<FormState, FormData>(forgotPassword, {});
  if (state.success) return <Alert tone="success">{state.success}</Alert>;
  return (
    <form action={action} className="grid gap-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <Field label="Email" name="email" type="email" autoComplete="email" required
        defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <SubmitButton size="lg" pendingText="Sending link…">Send reset link</SubmitButton>
    </form>
  );
}

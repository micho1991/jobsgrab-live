"use client";
import { useActionState } from "react";
import { resetPassword } from "../actions";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";

export function ResetForm() {
  const [state, action] = useActionState<FormState, FormData>(resetPassword, {});
  return (
    <form action={action} className="grid gap-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <PasswordInput name="password" label="New password" autoComplete="new-password" showRules error={state.fieldErrors?.password} />
      <PasswordInput name="confirmPassword" label="Confirm new password" autoComplete="new-password" error={state.fieldErrors?.confirmPassword} />
      <SubmitButton size="lg" pendingText="Saving…">Save new password</SubmitButton>
    </form>
  );
}

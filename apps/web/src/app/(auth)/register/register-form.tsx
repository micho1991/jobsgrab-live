"use client";
import { useActionState } from "react";
import Link from "next/link";
import { register } from "../actions";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";

export function RegisterForm() {
  const [state, action] = useActionState<FormState, FormData>(register, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" name="firstName" autoComplete="given-name" required maxLength={100}
          defaultValue={state.values?.firstName} error={fe.firstName} />
        <Field label="Last name" name="lastName" autoComplete="family-name" required maxLength={100}
          defaultValue={state.values?.lastName} error={fe.lastName} />
      </div>
      <Field label="Email" name="email" type="email" autoComplete="email" required
        defaultValue={state.values?.email} error={fe.email}
        hint="We'll send a link to confirm it's you." />
      <PasswordInput name="password" label="Password" autoComplete="new-password" showRules error={fe.password} />
      <PasswordInput name="confirmPassword" label="Confirm password" autoComplete="new-password" error={fe.confirmPassword} />
      <SubmitButton size="lg" pendingText="Creating account…">Create account</SubmitButton>
      <p className="text-sm text-muted">
        By creating an account you agree that we process your details to manage your applications, as described in our{" "}
        <Link href="/privacy" className="text-ink underline underline-offset-2">privacy policy</Link>.
      </p>
    </form>
  );
}

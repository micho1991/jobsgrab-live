"use client";
import { useActionState } from "react";
import Link from "next/link";
import { login } from "../actions";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action} className="grid gap-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="next" value={next} />
      <Field label="Email" name="email" type="email" autoComplete="email" required
        defaultValue={state.values?.email} error={state.fieldErrors?.email} />
      <div>
        <PasswordInput name="password" label="Password" autoComplete="current-password" error={state.fieldErrors?.password} />
        <Link href="/forgot-password" className="mt-2 inline-block text-sm font-medium text-steel hover:text-ink">Forgot your password?</Link>
      </div>
      <SubmitButton size="lg" pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}

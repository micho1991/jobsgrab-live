"use client";
import { useActionState } from "react";
import { updateProfile, changeEmail, changePassword, requestDeletion } from "./actions";
import { Field, inputClass, Label, FieldMessage } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";

function Messages({ state }: { state: FormState }) {
  return (
    <>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
    </>
  );
}

export interface ProfileDefaults {
  firstName: string; lastName: string; phone: string; address: string; city: string; country: string;
}

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const [state, action] = useActionState<FormState, FormData>(updateProfile, {});
  const v = { ...defaults, ...state.values };
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid gap-5" noValidate>
      <Messages state={state} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="First name" name="firstName" autoComplete="given-name" required maxLength={100} defaultValue={v.firstName} error={fe.firstName} />
        <Field label="Last name" name="lastName" autoComplete="family-name" required maxLength={100} defaultValue={v.lastName} error={fe.lastName} />
        <Field label="Phone number" name="phone" type="tel" autoComplete="tel" optional maxLength={30} defaultValue={v.phone} error={fe.phone} />
        <Field label="Address" name="address" autoComplete="street-address" optional maxLength={255} defaultValue={v.address} error={fe.address} />
        <Field label="City" name="city" autoComplete="address-level2" optional maxLength={100} defaultValue={v.city} error={fe.city} />
        <Field label="Country" name="country" autoComplete="country-name" optional maxLength={100} defaultValue={v.country} error={fe.country} />
      </div>
      <div><SubmitButton pendingText="Saving…">Save profile</SubmitButton></div>
    </form>
  );
}

export function EmailForm({ current }: { current: string }) {
  const [state, action] = useActionState<FormState, FormData>(changeEmail, {});
  return (
    <form action={action} className="grid gap-5" noValidate>
      <Messages state={state} />
      <p className="text-sm text-muted">Current email: <span className="font-medium text-ink">{current}</span></p>
      <Field label="New email" name="email" type="email" autoComplete="email" required
        defaultValue={state.values?.email} error={state.fieldErrors?.email} className="max-w-md" />
      <div><SubmitButton variant="secondary" pendingText="Sending…">Change email</SubmitButton></div>
    </form>
  );
}

export function PasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(changePassword, {});
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="grid max-w-md gap-5" noValidate key={state.success}>
      <Messages state={state} />
      <PasswordInput name="currentPassword" label="Current password" autoComplete="current-password" error={fe.currentPassword} />
      <PasswordInput name="password" label="New password" autoComplete="new-password" showRules error={fe.password} />
      <PasswordInput name="confirmPassword" label="Confirm new password" autoComplete="new-password" error={fe.confirmPassword} />
      <div><SubmitButton variant="secondary" pendingText="Saving…">Change password</SubmitButton></div>
    </form>
  );
}

export function DeletionForm() {
  const [state, action] = useActionState<FormState, FormData>(requestDeletion, {});
  if (state.success) return <Alert tone="success">{state.success}</Alert>;
  return (
    <form action={action} className="grid gap-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <div>
        <Label htmlFor="reason" optional>Reason</Label>
        <textarea id="reason" name="reason" rows={3} maxLength={2000}
          className={`${inputClass()} h-auto py-2.5`} placeholder="Helps us improve, but you don't have to tell us." />
      </div>
      <div>
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" name="confirm" className="mt-0.5 size-4 accent-[var(--color-bad)]"
            aria-invalid={!!state.fieldErrors?.confirm} aria-describedby={state.fieldErrors?.confirm ? "confirm-error" : undefined} />
          <span>I understand this permanently deletes my account, applications and uploaded documents, and withdraws any open applications.</span>
        </label>
        <FieldMessage id="confirm" error={state.fieldErrors?.confirm} />
      </div>
      <div><SubmitButton variant="danger" pendingText="Sending request…">Request deletion</SubmitButton></div>
    </form>
  );
}

"use client";
import { useActionState } from "react";
import { EMPLOYMENT_TYPES } from "@hr/shared";
import { savePosition } from "./actions";
import { Field, Label, FieldMessage, inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { ButtonLink } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import type { FormState } from "@/lib/forms";

export interface PositionDefaults {
  id?: string; title: string; department: string; location: string; employmentType: string;
  description: string; applicationDeadline: string; status: "open" | "closed"; isActive: boolean;
}

export function PositionForm({ defaults }: { defaults: PositionDefaults }) {
  const [state, action] = useActionState<FormState, FormData>(savePosition, {});
  const v = { ...defaults, ...(state.values ?? {}) } as PositionDefaults & Record<string, string>;
  const fe = state.fieldErrors ?? {};
  const isActive = state.values ? state.values.isActive === "on" : defaults.isActive;
  return (
    <form action={action} className="grid gap-5" noValidate>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {defaults.id && <input type="hidden" name="id" value={defaults.id} />}
      <Field label="Job title" name="title" required maxLength={150} defaultValue={v.title} error={fe.title} />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Department" name="department" optional maxLength={100} defaultValue={v.department} error={fe.department} />
        <Field label="Location" name="location" optional maxLength={150} defaultValue={v.location} error={fe.location} hint="For example: Remote, or Skopje" />
        <div>
          <Label htmlFor="employmentType">Employment type</Label>
          <select id="employmentType" name="employmentType" defaultValue={v.employmentType} className={inputClass()}>
            {Object.entries(EMPLOYMENT_TYPES).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <Field label="Application deadline" name="applicationDeadline" type="date" optional defaultValue={v.applicationDeadline}
          error={fe.applicationDeadline} hint="Applications close at the end of this day" />
      </div>
      <div>
        <Label htmlFor="description">Job description</Label>
        <textarea id="description" name="description" rows={10} maxLength={20000} defaultValue={v.description}
          className={`${inputClass(!!fe.description)} h-auto py-2.5 leading-relaxed`} />
        <FieldMessage id="description" error={fe.description} hint="Shown to candidates on the job board. Line breaks are kept." />
      </div>
      <fieldset className="grid gap-3 rounded-[var(--radius-control)] border border-line p-4">
        <legend className="px-1 text-sm font-medium text-ink">Visibility</legend>
        <div className="flex flex-wrap gap-5 text-sm">
          <label className="flex items-center gap-2"><input type="radio" name="status" value="open" defaultChecked={v.status === "open"} className="accent-[var(--color-ink)]" />Open for applications</label>
          <label className="flex items-center gap-2"><input type="radio" name="status" value="closed" defaultChecked={v.status === "closed"} className="accent-[var(--color-ink)]" />Closed</label>
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={isActive} className="mt-0.5 size-4 accent-[var(--color-ink)]" />
          <span>Active <span className="text-muted">(inactive positions are hidden everywhere outside HR)</span></span>
        </label>
        <p className="text-xs text-muted">Candidates see a position only when it&rsquo;s active, open and before its deadline.</p>
      </fieldset>
      <div className="flex gap-3">
        <SubmitButton pendingText="Saving…">{defaults.id ? "Save changes" : "Create position"}</SubmitButton>
        <ButtonLink href="/hr/positions" variant="ghost">Cancel</ButtonLink>
      </div>
    </form>
  );
}

"use client";
import { useActionState, useState, useTransition } from "react";
import type { AppRole } from "@hr/shared";
import { addTeamMember, saveNotificationPrefs, setRole } from "./actions";
import { Field, Label, inputClass } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Alert } from "@/components/ui/alert";
import { ROLE_LABEL } from "@/lib/hr/permissions";
import type { FormState } from "@/lib/forms";

export interface Member { id: string; name: string; email: string; role: AppRole }

const STAFF_ROLES: AppRole[] = ["hr_viewer", "hr_recruiter", "hr_admin"];

export function TeamTable({ members, meId, canManage }: { members: Member[]; meId: string; canManage: boolean }) {
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const change = (m: Member, role: AppRole) => start(async () => {
    const r = await setRole(m.id, role);
    setMsg(r.error ? { tone: "error", text: r.error }
      : { tone: "success", text: role === "candidate" ? `${m.name} no longer has HR access.` : `${m.name} is now ${ROLE_LABEL[role].toLowerCase().replace(/^hr/, "an HR")}.` });
  });
  return (
    <div className="grid gap-3">
      {msg && <div className="px-5 pt-4"><Alert tone={msg.tone}>{msg.text}</Alert></div>}
      <ul className="divide-y divide-line">
        {members.map((m) => (
          <li key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink">{m.name}{m.id === meId && " (you)"}</p>
              <p className="truncate text-xs text-muted">{m.email}</p>
            </div>
            {canManage && m.id !== meId ? (
              <div className="flex items-center gap-3">
                <label className="sr-only" htmlFor={`role-${m.id}`}>Role for {m.name}</label>
                <select id={`role-${m.id}`} value={m.role} disabled={pending} onChange={(e) => change(m, e.target.value as AppRole)}
                  className={`${inputClass()} h-8 w-auto text-sm`}>
                  {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                </select>
                <button type="button" disabled={pending} className="text-xs font-medium text-steel hover:text-bad"
                  onClick={() => { if (confirm(`Remove HR access for ${m.name}? Their account stays, as a candidate account.`)) change(m, "candidate"); }}>
                  Remove access
                </button>
              </div>
            ) : <span className="text-sm text-muted">{ROLE_LABEL[m.role]}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AddMemberForm() {
  const [state, action] = useActionState<FormState, FormData>(addTeamMember, {});
  return (
    <form action={action} className="grid gap-4 p-5" key={state.success}>
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
        <Field label="Email address" name="email" type="email" defaultValue={state.values?.email} error={state.fieldErrors?.email} hint="They need a careers-site account first." />
        <div>
          <Label htmlFor="new-role">Role</Label>
          <select id="new-role" name="role" defaultValue="hr_recruiter" className={inputClass()}>
            {STAFF_ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
          </select>
        </div>
      </div>
      <div><SubmitButton size="sm" pendingText="Adding…">Give HR access</SubmitButton></div>
    </form>
  );
}

export function NotificationPrefs({ registrations, applications }: { registrations: boolean; applications: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(saveNotificationPrefs, {});
  return (
    <form action={action} className="grid gap-3 p-5">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {state.success && <Alert tone="success">{state.success}</Alert>}
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="applications" defaultChecked={applications} className="size-4 accent-[var(--color-ink)]" />Email me when a new application is submitted</label>
      <label className="flex items-center gap-3 text-sm"><input type="checkbox" name="registrations" defaultChecked={registrations} className="size-4 accent-[var(--color-ink)]" />Email me when a new candidate registers</label>
      <div><SubmitButton size="sm" variant="secondary" pendingText="Saving…">Save preferences</SubmitButton></div>
    </form>
  );
}

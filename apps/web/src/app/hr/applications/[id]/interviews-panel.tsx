"use client";
import { useState, useTransition } from "react";
import { cancelInterview, scheduleInterview } from "../../actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { Field, Label, FieldMessage, inputClass } from "@/components/ui/field";
import { LocalTime } from "@/components/local-time";
import type { InterviewRow } from "@/lib/applications";

const MODE = { in_person: "In person", video: "Video call", phone: "Phone call" } as const;

export function InterviewsPanel({ applicationId, interviews, canWrite, firstName }: {
  applicationId: string; interviews: InterviewRow[]; canWrite: boolean; firstName: string;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<keyof typeof MODE>("video");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  function submit(fd: FormData) {
    const local = String(fd.get("scheduledAt") ?? "");
    const input = {
      // datetime-local is in the HR user's own timezone; send an absolute time
      scheduledAt: local ? new Date(local).toISOString() : "",
      durationMinutes: Number(fd.get("durationMinutes") ?? 60),
      mode,
      location: String(fd.get("location") ?? ""),
      meetingUrl: String(fd.get("meetingUrl") ?? ""),
      detailsForCandidate: String(fd.get("detailsForCandidate") ?? ""),
    };
    start(async () => {
      const r = await scheduleInterview(applicationId, input);
      setErrors(r.fieldErrors ?? {});
      if (r.error) setMsg({ tone: "error", text: r.error });
      else if (!r.fieldErrors) { setOpen(false); setMsg({ tone: "success", text: `Interview scheduled. ${firstName} has been emailed the details.` }); }
    });
  }

  return (
    <div className="grid gap-4 p-5">
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
      {interviews.length === 0 && !open && <p className="text-sm text-muted">No interviews yet.</p>}
      {interviews.length > 0 && (
        <ul className="grid gap-2">
          {interviews.map((iv) => {
            const past = new Date(iv.scheduled_at) < new Date();
            return (
              <li key={iv.id} className={`rounded-[var(--radius-control)] border border-line p-3 text-sm ${iv.cancelled_at ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className={`font-medium text-ink ${iv.cancelled_at ? "line-through" : ""}`}><LocalTime iso={iv.scheduled_at} format="long" /></p>
                    <p className="text-muted">{MODE[iv.mode]}, {iv.duration_minutes} min{iv.location ? `, ${iv.location}` : ""}</p>
                    {iv.meeting_url && <a href={iv.meeting_url} target="_blank" rel="noopener noreferrer" className="break-all text-ink underline underline-offset-2">{iv.meeting_url}</a>}
                    {iv.cancelled_at && <p className="text-xs text-muted">Cancelled</p>}
                  </div>
                  {canWrite && !iv.cancelled_at && !past && (
                    <button type="button" className="text-xs font-medium text-steel hover:text-bad" disabled={pending}
                      onClick={() => { if (confirm(`Cancel this interview? ${firstName} will be emailed.`)) start(async () => {
                        const r = await cancelInterview(iv.id);
                        setMsg(r.error ? { tone: "error", text: r.error } : { tone: "success", text: `Interview cancelled. ${firstName} has been emailed.` });
                      }); }}>Cancel interview</button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {canWrite && !open && <div><Button size="sm" variant="secondary" onClick={() => { setOpen(true); setMsg(null); }}>Schedule an interview</Button></div>}

      {canWrite && open && (
        /* onSubmit rather than a form action: React resets action forms after each
           submit, which would wipe what the recruiter typed when validation fails. */
        <form onSubmit={(e) => { e.preventDefault(); submit(new FormData(e.currentTarget)); }}
          className="grid gap-4 rounded-[var(--radius-control)] border border-line bg-mist/60 p-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date and time" name="scheduledAt" type="datetime-local" required error={errors.scheduledAt} hint="In your local time" />
            <div>
              <Label htmlFor="durationMinutes">Duration</Label>
              <select id="durationMinutes" name="durationMinutes" defaultValue="60" className={`${inputClass()} text-sm`}>
                {[30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} minutes</option>)}
              </select>
            </div>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">Format</legend>
            <div className="flex flex-wrap gap-4 text-sm">
              {(Object.keys(MODE) as (keyof typeof MODE)[]).map((m) => (
                <label key={m} className="flex items-center gap-2">
                  <input type="radio" name="mode" value={m} checked={mode === m} onChange={() => setMode(m)} className="accent-[var(--color-ink)]" />{MODE[m]}
                </label>
              ))}
            </div>
          </fieldset>
          {mode === "video" && <Field label="Meeting link" name="meetingUrl" type="url" placeholder="https://" error={errors.meetingUrl} />}
          {mode === "in_person" && <Field label="Address" name="location" error={errors.location} />}
          <div>
            <Label htmlFor="detailsForCandidate" optional>Note for {firstName}</Label>
            <textarea id="detailsForCandidate" name="detailsForCandidate" rows={3} maxLength={2000}
              placeholder="Who they'll meet, what to prepare" className={`${inputClass()} h-auto py-2 text-sm`} />
            <FieldMessage id="detailsForCandidate" error={errors.detailsForCandidate} hint="Included in the invitation email." />
          </div>
          <div className="flex gap-2">
            <Button size="sm" type="submit" disabled={pending}>{pending && <Spinner className="size-3.5" />}Schedule and email {firstName}</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => { setOpen(false); setErrors({}); }}>Cancel</Button>
          </div>
        </form>
      )}
    </div>
  );
}

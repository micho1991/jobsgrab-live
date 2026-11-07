"use client";
import { useState, useTransition } from "react";
import { addNote, deleteNote, updateNote } from "../../actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { inputClass } from "@/components/ui/field";
import { LocalTime } from "@/components/local-time";
import type { HrNote } from "@/lib/hr/types";

export function NotesPanel({ applicationId, notes, userId, canWrite, isAdmin }: {
  applicationId: string; notes: HrNote[]; userId: string; canWrite: boolean; isAdmin: boolean;
}) {
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ error?: string; fieldErrors?: Record<string, string> }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      const e = r.error ?? r.fieldErrors?.body;
      setError(e);
      if (!e) after?.();
    });

  return (
    <div className="grid gap-4 p-5">
      <p className="rounded-[var(--radius-control)] bg-mist px-3 py-2 text-xs text-muted">
        Internal to the HR team. Candidates never see these notes.
      </p>
      {error && <Alert tone="error">{error}</Alert>}
      {canWrite && (
        <form onSubmit={(e) => { e.preventDefault(); run(() => addNote(applicationId, draft), () => setDraft("")); }} className="grid gap-2">
          <label htmlFor="new-note" className="sr-only">Add a note</label>
          <textarea id="new-note" rows={3} maxLength={5000} value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a note for the team" className={`${inputClass()} h-auto py-2 text-sm`} />
          <div><Button size="sm" type="submit" disabled={pending || !draft.trim()}>{pending && !editing && <Spinner className="size-3.5" />}Add note</Button></div>
        </form>
      )}
      {notes.length === 0 ? <p className="text-sm text-muted">No notes yet.</p> : (
        <ul className="grid gap-3">
          {notes.map((n) => {
            const mine = n.author_id === userId;
            const isEditing = editing?.id === n.id;
            return (
              <li key={n.id} className="rounded-[var(--radius-control)] border border-line p-3">
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2 text-xs text-muted">
                  <span className="font-medium text-ink">{n.author ? `${n.author.first_name} ${n.author.last_name}` : "Former team member"}{mine && " (you)"}</span>
                  <span><LocalTime iso={n.created_at} />{n.updated_at !== n.created_at && ", edited"}</span>
                </div>
                {isEditing ? (
                  <form className="grid gap-2" onSubmit={(e) => { e.preventDefault(); run(() => updateNote(n.id, editing.body), () => setEditing(null)); }}>
                    <label htmlFor={`edit-${n.id}`} className="sr-only">Edit note</label>
                    <textarea id={`edit-${n.id}`} rows={3} maxLength={5000} value={editing.body}
                      onChange={(e) => setEditing({ id: n.id, body: e.target.value })} className={`${inputClass()} h-auto py-2 text-sm`} />
                    <div className="flex gap-2">
                      <Button size="sm" type="submit" disabled={pending}>Save</Button>
                      <Button size="sm" variant="ghost" type="button" onClick={() => setEditing(null)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <p className="whitespace-pre-line text-sm text-body">{n.body}</p>
                )}
                {!isEditing && canWrite && (mine || isAdmin) && (
                  <div className="mt-2 flex gap-3 text-xs">
                    {mine && <button type="button" onClick={() => setEditing({ id: n.id, body: n.body })} className="font-medium text-steel hover:text-ink">Edit</button>}
                    <button type="button" className="font-medium text-steel hover:text-bad"
                      onClick={() => { if (confirm("Delete this note? This can't be undone.")) run(() => deleteNote(n.id)); }}>Delete</button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

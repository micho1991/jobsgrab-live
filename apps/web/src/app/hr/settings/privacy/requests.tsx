"use client";
import { useState, useTransition } from "react";
import { processDeletion } from "../actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { inputClass } from "@/components/ui/field";

export function RequestActions({ id, name }: { id: string; name: string }) {
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const run = (action: "approve" | "reject") => start(async () => {
    const r = await processDeletion(id, action, note);
    setMsg(r.error ? { tone: "error", text: r.error } : { tone: "success", text: r.success! });
  });
  if (msg?.tone === "success") return <Alert tone="success">{msg.text}</Alert>;
  return (
    <div className="grid gap-3">
      {msg && <Alert tone="error">{msg.text}</Alert>}
      {mode === "reject" ? (
        <div className="grid gap-2">
          <label htmlFor={`note-${id}`} className="text-sm font-medium text-ink">Reason (emailed to {name})</label>
          <textarea id={`note-${id}`} rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} className={`${inputClass()} h-auto py-2 text-sm`} />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => run("reject")}>{pending && <Spinner className="size-3.5" />}Reject request</Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>Back</Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="danger" disabled={pending}
            onClick={() => { if (confirm(`Permanently delete ${name}'s account, applications, notes and documents? This can't be undone.`)) run("approve"); }}>
            {pending && <Spinner className="size-3.5" />}Delete all data
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setMode("reject")}>Reject</Button>
        </div>
      )}
    </div>
  );
}

"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { APPLICATION_STATUSES, STATUS_META, type ApplicationStatus } from "@hr/shared";
import { changeStatus } from "../../actions";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { inputClass } from "@/components/ui/field";

export function StatusControl({ applicationId, status, firstName }: { applicationId: string; status: ApplicationStatus; firstName: string }) {
  const [value, setValue] = useState<ApplicationStatus>(status);
  const [msg, setMsg] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const justSet = useRef<ApplicationStatus | null>(null);
  const changed = value !== status;

  // Follow the real status when something else changes it (e.g. scheduling an
  // interview, or a colleague). Otherwise the menu would offer to move the
  // candidate back to a stale stage.
  useEffect(() => {
    setValue(status);
    if (status !== justSet.current) setMsg(null);
    justSet.current = null;
  }, [status]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[200px] flex-1">
          <label htmlFor="status" className="mb-1 block text-xs font-medium text-muted">Stage</label>
          <select id="status" value={value} onChange={(e) => { setValue(e.target.value as ApplicationStatus); setMsg(null); }}
            className={`${inputClass()} h-9 text-sm`}>
            {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
          </select>
        </div>
        <Button size="sm" className="h-9" disabled={!changed || pending}
          onClick={() => start(async () => {
            justSet.current = value;
            const res = await changeStatus(applicationId, value);
            setMsg(res.error ? { tone: "error", text: res.error }
              : { tone: "success", text: `Moved to ${STATUS_META[value].label}. ${firstName} has been emailed.` });
          })}>
          {pending && <Spinner className="size-3.5" />}Update stage
        </Button>
      </div>
      {changed && !msg && <p className="text-xs text-muted">{firstName} will get an email and an in-app update about this change.</p>}
      {msg && <Alert tone={msg.tone}>{msg.text}</Alert>}
    </div>
  );
}

"use client";
import { useState } from "react";
import { DOCUMENT_KIND_LABEL, formatBytes } from "@hr/shared";
import { hrDocumentUrl } from "../../actions";
import { FileIcon } from "@/components/file-drop";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { buttonClass } from "@/components/ui/button";
import type { HrDocument } from "@/lib/hr/types";
import { fmtDate } from "@/lib/format";

export function HrDocuments({ documents }: { documents: HrDocument[] }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const order = ["cv", "cover_letter", "other"];
  const current = documents.filter((d) => !d.replaced_at).sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const previous = documents.filter((d) => d.replaced_at);

  async function download(d: HrDocument) {
    setBusy(d.id); setError(undefined);
    const r = await hrDocumentUrl(d.id);
    setBusy(null);
    if (r.url) window.location.assign(r.url); else setError(r.error);
  }

  const row = (d: HrDocument) => (
    <li key={d.id} className="flex items-center gap-3 px-4 py-2.5">
      <FileIcon />
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted">{DOCUMENT_KIND_LABEL[d.kind]}{d.replaced_at && `, replaced ${fmtDate(d.replaced_at)}`}</p>
        <p className="truncate text-sm font-medium text-ink">{d.file_name}</p>
        <p className="text-xs text-muted">{formatBytes(d.size_bytes)}, uploaded {fmtDate(d.created_at)}</p>
      </div>
      <button type="button" onClick={() => void download(d)} disabled={!!busy} className={buttonClass("secondary", "sm")}
        aria-label={`Download ${d.file_name}`}>{busy === d.id && <Spinner className="size-3.5" />}Download</button>
    </li>
  );

  return (
    <div className="grid gap-3 p-5">
      {error && <Alert tone="error">{error}</Alert>}
      <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">{current.map(row)}</ul>
      {previous.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-medium text-steel hover:text-ink">Earlier versions ({previous.length})</summary>
          <ul className="mt-2 divide-y divide-line rounded-[var(--radius-control)] border border-line">{previous.map(row)}</ul>
        </details>
      )}
      <p className="text-xs text-muted">Downloads are logged for data protection.</p>
    </div>
  );
}

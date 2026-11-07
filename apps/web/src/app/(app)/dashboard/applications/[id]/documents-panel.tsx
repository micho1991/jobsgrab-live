"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ACCEPT_ATTRIBUTE, DOCUMENT_KIND_LABEL, formatBytes, MAX_ADDITIONAL_DOCUMENTS, type DocumentKind } from "@hr/shared";
import { attachDocument, getDocumentUrl } from "../../actions";
import { uploadDocument, discardUpload } from "@/lib/upload";
import { FileIcon } from "@/components/file-drop";
import { Alert } from "@/components/ui/alert";
import { Spinner } from "@/components/ui/spinner";
import { buttonClass } from "@/components/ui/button";
import type { DocumentRow } from "@/lib/applications";
import { fmtDate } from "@/lib/format";

export function DocumentsPanel({ applicationId, userId, documents, locked }: {
  applicationId: string; userId: string; documents: DocumentRow[]; locked: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [, startTransition] = useTransition();
  const picker = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<DocumentKind>("other");

  const order: DocumentKind[] = ["cv", "cover_letter", "other"];
  const sorted = [...documents].sort((a, b) => order.indexOf(a.kind) - order.indexOf(b.kind));
  const otherCount = documents.filter((d) => d.kind === "other").length;

  async function download(doc: DocumentRow) {
    setBusy(`dl-${doc.id}`); setMessage(null);
    const res = await getDocumentUrl(doc.id);
    setBusy(null);
    if (res.url) window.location.assign(res.url);
    else setMessage({ tone: "error", text: res.error ?? "Download failed." });
  }

  function choose(kind: DocumentKind) {
    pendingKind.current = kind;
    picker.current?.click();
  }

  async function onPicked(file: File | undefined) {
    if (picker.current) picker.current.value = "";
    if (!file) return;
    const kind = pendingKind.current;
    setBusy(`up-${kind}`); setMessage(null);
    const up = await uploadDocument(userId, file);
    if (!up.file) { setBusy(null); setMessage({ tone: "error", text: up.error ?? "Upload failed." }); return; }
    const res = await attachDocument({ applicationId, kind, path: up.file.path, name: up.file.name });
    setBusy(null);
    if (res.error) {
      await discardUpload(up.file.path);
      setMessage({ tone: "error", text: res.error });
      return;
    }
    setMessage({ tone: "success", text: kind === "other" ? `${file.name} was added.` : `Your ${DOCUMENT_KIND_LABEL[kind].toLowerCase()} was replaced with ${file.name}.` });
    startTransition(() => router.refresh());
  }

  return (
    <div className="grid gap-4">
      {message && <Alert tone={message.tone}>{message.text}</Alert>}
      <input ref={picker} type="file" accept={ACCEPT_ATTRIBUTE} className="sr-only" tabIndex={-1} aria-hidden="true"
        onChange={(e) => void onPicked(e.target.files?.[0])} />
      <ul className="divide-y divide-line rounded-[var(--radius-control)] border border-line">
        {sorted.map((d) => (
          <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <FileIcon />
            <div className="min-w-0 flex-1">
              <p className="text-xs text-muted">{DOCUMENT_KIND_LABEL[d.kind]}</p>
              <p className="truncate text-sm font-medium text-ink">{d.file_name}</p>
              <p className="text-xs text-muted">{formatBytes(d.size_bytes)}, uploaded {fmtDate(d.created_at)}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void download(d)} disabled={!!busy}
                className={buttonClass("secondary", "sm")} aria-label={`Download ${d.file_name}`}>
                {busy === `dl-${d.id}` && <Spinner className="size-3.5" />}Download
              </button>
              {!locked && d.kind !== "other" && (
                <button type="button" onClick={() => choose(d.kind)} disabled={!!busy} className={buttonClass("ghost", "sm")}>
                  {busy === `up-${d.kind}` && <Spinner className="size-3.5" />}Replace
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      {!locked && otherCount < MAX_ADDITIONAL_DOCUMENTS && (
        <div>
          <button type="button" onClick={() => choose("other")} disabled={!!busy} className={buttonClass("secondary")}>
            {busy === "up-other" && <Spinner />}Add a document
          </button>
          <p className="mt-2 text-sm text-muted">Certificates, references or a portfolio. PDF, DOC or DOCX, up to 10 MB.</p>
        </div>
      )}
      {locked && <p className="text-sm text-muted">Documents can&rsquo;t be changed once a decision has been made.</p>}
    </div>
  );
}

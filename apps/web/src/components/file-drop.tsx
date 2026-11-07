"use client";
import { useId, useRef, useState } from "react";
import { ACCEPT_ATTRIBUTE, formatBytes } from "@hr/shared";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

interface Props {
  label: string;
  description?: string;
  required?: boolean;
  error?: string;
  /** Files already chosen for this slot */
  files: { name: string; size: number }[];
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => Promise<void>;
  onRemove?: (index: number) => void;
}

/** Click-or-drop file picker for CVs and other documents. */
export function FileDrop({ label, description, required, error, files, multiple, disabled, onFiles, onRemove }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);
  const full = !multiple && files.length > 0;

  async function handle(list: FileList | null) {
    if (!list?.length || busy) return;
    setBusy(true);
    try { await onFiles(Array.from(multiple ? list : [list[0]!])); } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span id={`${id}-label`} className="text-sm font-medium text-ink">{label}</span>
        {!required && <span className="text-xs text-muted">Optional</span>}
      </div>

      {files.length > 0 && (
        <ul className="mb-2 grid gap-2">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center gap-3 rounded-[var(--radius-control)] border border-line bg-white px-3 py-2.5">
              <FileIcon />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{f.name}</p>
                <p className="text-xs text-muted">{formatBytes(f.size)}, uploaded</p>
              </div>
              {onRemove && (
                <button type="button" onClick={() => onRemove(i)} disabled={disabled}
                  className="rounded-md px-2 py-1 text-sm font-medium text-steel hover:bg-mist hover:text-bad"
                  aria-label={`Remove ${f.name}`}>Remove</button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <label htmlFor={id}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); void handle(e.dataTransfer.files); }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-[var(--radius-control)] border border-dashed px-4 py-6 text-center transition-colors",
            over ? "border-ink bg-info-bg" : error ? "border-bad bg-bad-bg/40" : "border-steel-light bg-mist hover:border-ink",
            (busy || disabled) && "pointer-events-none opacity-70",
          )}>
          {busy ? (
            <span className="flex items-center gap-2 text-sm font-medium text-ink"><Spinner /> Uploading…</span>
          ) : (
            <>
              <span className="text-sm font-medium text-ink">
                {files.length > 0 ? "Add another file" : "Choose a file"} <span className="font-normal text-muted">or drag it here</span>
              </span>
              <span className="text-xs text-muted">{description ?? "PDF, DOC or DOCX, up to 10 MB"}</span>
            </>
          )}
          <input ref={input} id={id} type="file" className="sr-only" accept={ACCEPT_ATTRIBUTE} multiple={multiple}
            aria-labelledby={`${id}-label`} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined}
            disabled={busy || disabled} onChange={(e) => void handle(e.target.files)} />
        </label>
      )}
      {error && <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-bad">{error}</p>}
    </div>
  );
}

export function FileIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5 shrink-0 text-steel" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" />
    </svg>
  );
}

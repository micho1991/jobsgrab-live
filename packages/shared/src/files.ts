// Upload rules (mirror the storage bucket config + documents table constraints).
export const STORAGE_BUCKET = "candidate-documents";
export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_ADDITIONAL_DOCUMENTS = 10;

export const ALLOWED_MIME_TYPES = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;
export type AllowedMimeType = keyof typeof ALLOWED_MIME_TYPES;
export const ACCEPT_ATTRIBUTE = ".pdf,.doc,.docx," + Object.keys(ALLOWED_MIME_TYPES).join(",");

export type DocumentKind = "cv" | "cover_letter" | "other";
export const DOCUMENT_KIND_LABEL: Record<DocumentKind, string> = {
  cv: "CV / Resume", cover_letter: "Cover letter", other: "Additional document",
};

const EXT_TO_MIME: Record<string, AllowedMimeType> = {
  pdf: "application/pdf", doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/** Resolve a trustworthy MIME type (mobile pickers sometimes report octet-stream). */
export function resolveMimeType(fileName: string, reported?: string | null): AllowedMimeType | null {
  if (reported && reported in ALLOWED_MIME_TYPES) return reported as AllowedMimeType;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  return EXT_TO_MIME[ext] ?? null;
}

export type FileCheck = { ok: true; mimeType: AllowedMimeType } | { ok: false; error: string };

export function validateFile(file: { name: string; size: number; type?: string | null }): FileCheck {
  const mimeType = resolveMimeType(file.name, file.type);
  if (!mimeType) return { ok: false, error: "Only PDF, DOC and DOCX files are accepted." };
  if (file.size <= 0) return { ok: false, error: "This file is empty." };
  if (file.size > MAX_FILE_BYTES) return { ok: false, error: "Files must be 10 MB or smaller." };
  return { ok: true, mimeType };
}

/** Storage path: {userId}/{random}.{ext} — the user's folder is enforced by storage RLS. */
export function buildStoragePath(userId: string, mimeType: AllowedMimeType): string {
  return `${userId}/${crypto.randomUUID()}.${ALLOWED_MIME_TYPES[mimeType]}`;
}

export const formatBytes = (n: number) =>
  n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;

"use client";
import { STORAGE_BUCKET, buildStoragePath, validateFile } from "@hr/shared";
import { createClient } from "@/lib/supabase/client";
import type { UploadedFile } from "@/lib/applications";

/** Upload straight from the browser into the user's private folder. */
export async function uploadDocument(userId: string, file: File): Promise<{ file?: UploadedFile; error?: string }> {
  const check = validateFile(file);
  if (!check.ok) return { error: check.error };
  const path = buildStoragePath(userId, check.mimeType);
  // Re-wrap so the stored content type is always the validated one.
  const body = new File([file], file.name, { type: check.mimeType });
  const { error } = await createClient().storage.from(STORAGE_BUCKET).upload(path, body, {
    contentType: check.mimeType, upsert: false, cacheControl: "0",
  });
  if (error) return { error: "The upload didn't complete. Check your connection and try again." };
  return { file: { path, name: file.name, size: file.size, mimeType: check.mimeType } };
}

/** Remove an upload that was never attached to an application (storage RLS allows only this). */
export async function discardUpload(path: string) {
  await createClient().storage.from(STORAGE_BUCKET).remove([path]);
}

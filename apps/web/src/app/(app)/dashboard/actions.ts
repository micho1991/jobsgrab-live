"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { STORAGE_BUCKET, friendlyError } from "@hr/shared";
import { createClient } from "@/lib/supabase/server";

/** Short-lived download link for one of the user's own documents (RLS-checked). */
export async function getDocumentUrl(documentId: string): Promise<{ url?: string; error?: string }> {
  if (!z.string().uuid().safeParse(documentId).success) return { error: "Document not found." };
  const supabase = await createClient();
  const { data: doc } = await supabase.from("documents").select("storage_path, file_name").eq("id", documentId).maybeSingle();
  if (!doc) return { error: "Document not found." };
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET)
    .createSignedUrl(doc.storage_path, 60, { download: doc.file_name });
  if (error || !data) return { error: "The download link couldn't be created. Try again." };
  return { url: data.signedUrl };
}

const attachSchema = z.object({
  applicationId: z.string().uuid(),
  kind: z.enum(["cv", "cover_letter", "other"]),
  path: z.string().max(200),
  name: z.string().trim().min(1).max(255),
});

/** Attach an uploaded file: replaces the current CV/cover letter, or adds an extra document. */
export async function attachDocument(input: z.infer<typeof attachSchema>): Promise<{ error?: string }> {
  const parsed = attachSchema.safeParse(input);
  if (!parsed.success) return { error: "That file couldn't be attached. Upload it again." };
  const { applicationId, kind, path, name } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_or_replace_document", {
    p_application_id: applicationId, p_kind: kind, p_storage_path: path, p_file_name: name,
  });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/dashboard/applications/${applicationId}`);
  return {};
}

export async function markNotificationsRead(): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read", { p_ids: null });
  revalidatePath("/dashboard", "layout");
}

"use server";

// Every action runs with the signed-in user's JWT, so Row-Level Security decides
// what is allowed (e.g. HR viewers can read but not change anything). The checks
// here only produce friendlier messages.
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  APPLICATION_STATUSES, STORAGE_BUCKET, interviewSchema, noteSchema, friendlyError, type ApplicationStatus,
} from "@hr/shared";
import { createClient } from "@/lib/supabase/server";

export interface ActionResult { error?: string; fieldErrors?: Record<string, string> }

const uuid = z.string().uuid();
const NO_PERMISSION = "You don't have permission to do that. Ask an HR admin if you need access.";

async function client() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

function refresh(applicationId?: string) {
  if (applicationId) revalidatePath(`/hr/applications/${applicationId}`);
  revalidatePath("/hr", "layout");
}

// ------------------------------------------------------------------ status --
export async function changeStatus(applicationId: string, status: ApplicationStatus): Promise<ActionResult> {
  if (!uuid.safeParse(applicationId).success || !APPLICATION_STATUSES.includes(status)) return { error: "Invalid request." };
  const { supabase, user } = await client();
  if (!user) return { error: "Your session has expired. Sign in again." };
  const { data, error } = await supabase.from("applications").update({ status }).eq("id", applicationId).select("id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: NO_PERMISSION }; // RLS filtered the row out
  refresh(applicationId);
  return {};
}

// ------------------------------------------------------------------- notes --
export async function addNote(applicationId: string, body: string): Promise<ActionResult> {
  const parsed = noteSchema.safeParse({ body });
  if (!parsed.success) return { fieldErrors: { body: parsed.error.issues[0]!.message } };
  if (!uuid.safeParse(applicationId).success) return { error: "Invalid request." };
  const { supabase, user } = await client();
  if (!user) return { error: "Your session has expired. Sign in again." };
  const { error } = await supabase.from("application_notes")
    .insert({ application_id: applicationId, author_id: user.id, body: parsed.data.body });
  if (error) return { error: error.code === "42501" ? NO_PERMISSION : friendlyError(error) };
  refresh(applicationId);
  return {};
}

export async function updateNote(noteId: string, body: string): Promise<ActionResult> {
  const parsed = noteSchema.safeParse({ body });
  if (!parsed.success) return { fieldErrors: { body: parsed.error.issues[0]!.message } };
  if (!uuid.safeParse(noteId).success) return { error: "Invalid request." };
  const { supabase } = await client();
  const { data, error } = await supabase.from("application_notes").update({ body: parsed.data.body })
    .eq("id", noteId).select("application_id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "You can only edit your own notes." };
  refresh(data[0]!.application_id);
  return {};
}

export async function deleteNote(noteId: string): Promise<ActionResult> {
  if (!uuid.safeParse(noteId).success) return { error: "Invalid request." };
  const { supabase } = await client();
  const { data, error } = await supabase.from("application_notes").delete().eq("id", noteId).select("application_id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: "You can only delete your own notes." };
  refresh(data[0]!.application_id);
  return {};
}

// -------------------------------------------------------------- interviews --
export async function scheduleInterview(applicationId: string, input: unknown): Promise<ActionResult> {
  if (!uuid.safeParse(applicationId).success) return { error: "Invalid request." };
  const parsed = interviewSchema.safeParse(input);
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { fieldErrors: fe };
  }
  const v = parsed.data;
  if (new Date(v.scheduledAt) < new Date()) return { fieldErrors: { scheduledAt: "Choose a time in the future" } };
  if (v.mode === "video" && !v.meetingUrl) return { fieldErrors: { meetingUrl: "Add the meeting link for a video interview" } };
  if (v.mode === "in_person" && !v.location) return { fieldErrors: { location: "Add the address for an in-person interview" } };

  const { supabase, user } = await client();
  if (!user) return { error: "Your session has expired. Sign in again." };
  const { error } = await supabase.from("interviews").insert({
    application_id: applicationId, scheduled_at: v.scheduledAt, duration_minutes: v.durationMinutes, mode: v.mode,
    location: v.location || null, meeting_url: v.meetingUrl || null, details_for_candidate: v.detailsForCandidate || null,
    created_by: user.id,
  });
  if (error) return { error: error.code === "42501" ? NO_PERMISSION : friendlyError(error) };
  refresh(applicationId);
  return {};
}

export async function cancelInterview(interviewId: string): Promise<ActionResult> {
  if (!uuid.safeParse(interviewId).success) return { error: "Invalid request." };
  const { supabase } = await client();
  const { data, error } = await supabase.from("interviews").update({ cancelled_at: new Date().toISOString() })
    .eq("id", interviewId).is("cancelled_at", null).select("application_id");
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: NO_PERMISSION };
  refresh(data[0]!.application_id);
  return {};
}

// --------------------------------------------------------------- documents --
/** Signed download link for any candidate document; every access is audited. */
export async function hrDocumentUrl(documentId: string): Promise<{ url?: string; error?: string }> {
  if (!uuid.safeParse(documentId).success) return { error: "Document not found." };
  const { supabase } = await client();
  const { data: doc } = await supabase.from("documents").select("storage_path, file_name").eq("id", documentId).maybeSingle();
  if (!doc) return { error: "Document not found." };
  const { error: logErr } = await supabase.rpc("log_document_access", { p_document_id: documentId });
  if (logErr) return { error: NO_PERMISSION };
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(doc.storage_path, 60, { download: doc.file_name });
  if (error || !data) return { error: "The download link couldn't be created. Try again." };
  return { url: data.signedUrl };
}

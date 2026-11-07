"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ROLES, emailSchema, friendlyError, type AppRole } from "@hr/shared";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/forms";

export async function setRole(userId: string, role: AppRole): Promise<{ error?: string }> {
  if (!z.string().uuid().safeParse(userId).success || !ROLES.includes(role)) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").update({ role }).eq("id", userId).select("id");
  if (error) return { error: friendlyError(error) }; // e.g. "You cannot change your own role"
  if (!data?.length) return { error: "Only HR admins can change roles." };
  revalidatePath("/hr/settings");
  return {};
}

/** Give an existing (registered) user an HR role, found by email. */
export async function addTeamMember(_prev: FormState, fd: FormData): Promise<FormState> {
  const email = emailSchema.safeParse(fd.get("email"));
  const role = z.enum(["hr_viewer", "hr_recruiter", "hr_admin"]).safeParse(fd.get("role"));
  const values = { email: String(fd.get("email") ?? "") };
  if (!email.success) return { fieldErrors: { email: "Enter a valid email address" }, values };
  if (!role.success) return { fieldErrors: { role: "Choose a role" }, values };
  const supabase = await createClient();
  const { data: found } = await supabase.from("profiles").select("id, role").eq("email", email.data).maybeSingle();
  if (!found) {
    return { error: `No account uses ${email.data}. Ask them to create an account on the careers site first, then add them here.`, values };
  }
  if (found.role !== "candidate") return { error: `${email.data} is already on the HR team.`, values };
  const res = await setRole(found.id, role.data);
  if (res.error) return { error: res.error, values };
  return { success: `${email.data} now has HR access.` };
}

export async function saveNotificationPrefs(_prev: FormState, fd: FormData): Promise<FormState> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your session has expired. Sign in again." };
  const { error } = await supabase.from("profiles").update({
    notify_new_registrations: fd.get("registrations") === "on",
    notify_new_applications: fd.get("applications") === "on",
  }).eq("id", user.id);
  if (error) return { error: friendlyError(error) };
  return { success: "Notification preferences saved." };
}

/** Approve or reject a GDPR deletion request via the process-deletion Edge Function. */
export async function processDeletion(requestId: string, action: "approve" | "reject", note?: string): Promise<{ error?: string; success?: string }> {
  if (!z.string().uuid().safeParse(requestId).success) return { error: "Invalid request." };
  const supabase = await createClient();
  const { data, error } = await supabase.functions.invoke("process-deletion", {
    body: { request_id: requestId, action, note: note?.slice(0, 2000) || undefined },
  });
  if (error) {
    let msg = "The request couldn't be processed. Try again.";
    try { const body = await (error as { context?: Response }).context?.json(); if (body?.error) msg = body.error; } catch {}
    return { error: msg };
  }
  revalidatePath("/hr/settings/privacy"); revalidatePath("/hr", "layout");
  return { success: action === "approve" ? `Deleted. ${data?.files_removed ?? 0} files removed and a confirmation email queued.` : "Request rejected and the person has been emailed." };
}

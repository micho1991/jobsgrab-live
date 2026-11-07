"use server";

import { revalidatePath } from "next/cache";
import { emailSchema, passwordSchema, profileSchema, friendlyError } from "@hr/shared";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { authMessage } from "@/lib/auth-errors";
import { fieldErrors, formValues, type FormState } from "@/lib/forms";

async function currentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
}

const SESSION_EXPIRED: FormState = { error: "Your session has expired. Sign in again to continue." };

export async function updateProfile(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd, ["firstName", "lastName", "phone", "address", "city", "country"]);
  const parsed = profileSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const { supabase, user } = await currentUser();
  if (!user) return SESSION_EXPIRED;

  const v = parsed.data;
  const { error } = await supabase.from("profiles").update({
    first_name: v.firstName,
    last_name: v.lastName,
    phone: v.phone || null,
    address: v.address || null,
    city: v.city || null,
    country: v.country || null,
  }).eq("id", user.id);
  if (error) return { error: friendlyError(error), values };

  revalidatePath("/", "layout");
  return { success: "Profile saved.", values };
}

export async function changeEmail(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd, ["email"]);
  const parsed = emailSchema.safeParse(values.email);
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0]?.message ?? "Enter a valid email" }, values };

  const { supabase, user } = await currentUser();
  if (!user) return SESSION_EXPIRED;
  if (parsed.data === user.email) return { fieldErrors: { email: "This is already your email address." }, values };

  const { error } = await supabase.auth.updateUser(
    { email: parsed.data },
    { emailRedirectTo: `${env.siteUrl}/auth/callback?next=/account` },
  );
  if (error) return { error: authMessage(error), values };
  return {
    success: `We've sent confirmation links to ${user.email} and ${parsed.data}. Your email changes once you confirm both.`,
    values: { email: "" },
  };
}

export async function changePassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const current = String(fd.get("currentPassword") ?? "");
  const next = String(fd.get("password") ?? "");
  const confirm = String(fd.get("confirmPassword") ?? "");

  const errs: Record<string, string> = {};
  if (!current) errs.currentPassword = "Enter your current password";
  const p = passwordSchema.safeParse(next);
  if (!p.success) errs.password = p.error.issues[0]?.message ?? "Choose a stronger password";
  if (next !== confirm) errs.confirmPassword = "Passwords do not match";
  if (Object.keys(errs).length) return { fieldErrors: errs };

  const { supabase, user } = await currentUser();
  if (!user?.email) return SESSION_EXPIRED;

  // Re-verify the current password before allowing the change.
  const { error: verifyErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
  if (verifyErr) return { fieldErrors: { currentPassword: "Your current password is incorrect." } };

  const { error } = await supabase.auth.updateUser({ password: next });
  if (error) return { error: authMessage(error) };

  await supabase.auth.signOut({ scope: "others" });
  return { success: "Password changed. Other devices have been signed out." };
}

export async function requestDeletion(_prev: FormState, fd: FormData): Promise<FormState> {
  if (fd.get("confirm") !== "on") return { fieldErrors: { confirm: "Tick the box to confirm." } };
  const reason = String(fd.get("reason") ?? "").slice(0, 2000);

  const { supabase, user } = await currentUser();
  if (!user) return SESSION_EXPIRED;

  const { error } = await supabase.rpc("request_account_deletion", { p_reason: reason || null });
  if (error) return { error: friendlyError(error) };

  revalidatePath("/account");
  return { success: "Request received. We'll delete your data within 30 days and email you when it's done." };
}

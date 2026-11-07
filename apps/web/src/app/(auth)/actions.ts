"use server";

import { redirect } from "next/navigation";
import {
  registerSchema, loginSchema, forgotPasswordSchema, resetPasswordSchema, emailSchema,
} from "@hr/shared";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { safeNext } from "@/lib/safe-redirect";
import { fieldErrors, formValues, type FormState } from "@/lib/forms";
import { authMessage } from "@/lib/auth-errors";

// ---------------------------------------------------------------- register --
export async function register(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd, ["firstName", "lastName", "email"]);
  const parsed = registerSchema.safeParse({
    ...values,
    password: String(fd.get("password") ?? ""),
    confirmPassword: String(fd.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const { firstName, lastName, email, password } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName },
      emailRedirectTo: `${env.siteUrl}/auth/callback?next=/dashboard`,
    },
  });
  if (error) return { error: authMessage(error), values };

  // If email confirmation is disabled the user is signed in straight away.
  if (data.session) redirect("/dashboard");

  // Same response whether or not the address was already registered,
  // so the form can't be used to discover who has an account.
  redirect(`/verify-email?email=${encodeURIComponent(email)}`);
}

// ------------------------------------------------------------------- login --
export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd, ["email"]);
  const next = safeNext(fd.get("next"));
  const parsed = loginSchema.safeParse({ email: values.email, password: String(fd.get("password") ?? "") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (error.code === "email_not_confirmed") {
      redirect(`/verify-email?email=${encodeURIComponent(parsed.data.email)}&unconfirmed=1`);
    }
    if (error.code === "invalid_credentials" || error.status === 400) {
      return { error: "The email or password is incorrect.", values };
    }
    return { error: authMessage(error), values };
  }
  redirect(next);
}

// ------------------------------------------------------------ Google OAuth --
export async function signInWithGoogle(fd: FormData): Promise<void> {
  const next = safeNext(fd.get("next"));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${env.siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: { prompt: "select_account" },
    },
  });
  if (error || !data.url) redirect("/login?error=oauth");
  redirect(data.url);
}

// ------------------------------------------------- resend verification email --
export async function resendVerification(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = emailSchema.safeParse(fd.get("email"));
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0]?.message ?? "Enter a valid email" } };

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: `${env.siteUrl}/auth/callback?next=/dashboard` },
  });
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) {
    return { error: authMessage(error) };
  }
  return { success: `If ${parsed.data} has an unverified account, a new link is on its way.` };
}

// ---------------------------------------------------------- forgot password --
export async function forgotPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const values = formValues(fd, ["email"]);
  const parsed = forgotPasswordSchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${env.siteUrl}/auth/confirm?next=/reset-password`,
  });
  if (error && (error.status === 429 || error.code?.startsWith("over_"))) {
    return { error: authMessage(error), values };
  }
  return {
    success: `If an account exists for ${parsed.data.email}, we've sent a link to reset the password. It expires in 1 hour.`,
    values,
  };
}

// ----------------------------------------------------------- reset password --
export async function resetPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const parsed = resetPasswordSchema.safeParse({
    password: String(fd.get("password") ?? ""),
    confirmPassword: String(fd.get("confirmPassword") ?? ""),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Your reset link has expired. Request a new one to continue." };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: authMessage(error) };

  // Sign out every other device in case the old password was compromised.
  await supabase.auth.signOut({ scope: "others" });
  redirect("/dashboard?notice=password-updated");
}

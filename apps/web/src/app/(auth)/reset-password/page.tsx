import type { Metadata } from "next";
import { AuthHeading } from "../auth-heading";
import { ResetForm } from "./reset-form";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return (
      <>
        <AuthHeading title="This link has expired">
          Password reset links work once and expire after an hour. Request a new one to continue.
        </AuthHeading>
        <ButtonLink href="/forgot-password" size="lg" className="w-full">Request a new link</ButtonLink>
      </>
    );
  }
  return (
    <>
      <AuthHeading title="Choose a new password">
        For <strong className="font-semibold text-ink">{user.email}</strong>. You&rsquo;ll be signed out on other devices.
      </AuthHeading>
      <ResetForm />
      <Alert tone="info" className="mt-6">Use a password you don&rsquo;t use on other websites.</Alert>
    </>
  );
}

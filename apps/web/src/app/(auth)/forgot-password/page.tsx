import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "../auth-heading";
import { ForgotForm } from "./forgot-form";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <AuthHeading title="Reset your password">
        Enter the email you registered with and we&rsquo;ll send you a link to choose a new password.
      </AuthHeading>
      <ForgotForm />
      <p className="mt-8 text-sm text-muted">
        Remembered it? <Link href="/login" className="font-medium text-ink underline underline-offset-2">Back to sign in</Link>
      </p>
    </>
  );
}

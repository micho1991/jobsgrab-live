import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "../auth-heading";
import { ResendForm } from "./resend-form";
import { Alert } from "@/components/ui/alert";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const email = sp.email ?? "";
  return (
    <>
      <AuthHeading title="Check your inbox">
        {email
          ? <>We sent a confirmation link to <strong className="font-semibold text-ink">{email}</strong>. Open it to activate your account.</>
          : <>We sent you a confirmation link. Open it to activate your account.</>}
      </AuthHeading>
      {sp.unconfirmed && (
        <Alert tone="info" className="mb-6">You need to confirm your email address before you can sign in.</Alert>
      )}
      <div className="rounded-[var(--radius-panel)] border border-line bg-mist p-5 text-sm leading-relaxed">
        <p className="font-medium text-ink">Didn&rsquo;t get it?</p>
        <p className="mt-1 text-muted">Check your spam folder. The link expires after 24 hours. You can also request a new one.</p>
        <div className="mt-4"><ResendForm email={email} /></div>
      </div>
      <p className="mt-8 text-sm text-muted">
        Confirmed already? <Link href="/login" className="font-medium text-ink underline underline-offset-2">Sign in</Link>
      </p>
    </>
  );
}

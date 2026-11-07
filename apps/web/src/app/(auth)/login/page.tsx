import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "../auth-heading";
import { LoginForm } from "./login-form";
import { GoogleButton, OrDivider } from "@/components/google-button";
import { Alert } from "@/components/ui/alert";
import { safeNext } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  return (
    <>
      <AuthHeading title="Sign in">
        New here? <Link href={`/register${sp.next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium text-ink underline underline-offset-2">Create an account</Link>
      </AuthHeading>
      {sp.error === "oauth" && <Alert tone="error" className="mb-6">Google sign-in didn&rsquo;t complete. Try again or use your email and password.</Alert>}
      {sp.notice === "signed-out" && <Alert tone="success" className="mb-6">You&rsquo;ve been signed out.</Alert>}
      <GoogleButton next={next} />
      <OrDivider />
      <LoginForm next={next} />
    </>
  );
}

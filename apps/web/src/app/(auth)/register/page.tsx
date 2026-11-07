import type { Metadata } from "next";
import Link from "next/link";
import { AuthHeading } from "../auth-heading";
import { RegisterForm } from "./register-form";
import { GoogleButton, OrDivider } from "@/components/google-button";
import { safeNext } from "@/lib/safe-redirect";

export const metadata: Metadata = { title: "Create an account" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  return (
    <>
      <AuthHeading title="Create your account">
        Already registered? <Link href="/login" className="font-medium text-ink underline underline-offset-2">Sign in</Link>
      </AuthHeading>
      <GoogleButton next={safeNext(sp.next)} label="Sign up with Google" />
      <OrDivider />
      <RegisterForm />
    </>
  );
}

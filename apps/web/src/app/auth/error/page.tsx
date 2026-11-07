import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { ButtonLink } from "@/components/ui/button";

export const metadata: Metadata = { title: "Link not valid" };

const COPY = {
  link: {
    title: "This confirmation link isn't valid",
    body: "It may have expired or already been used. Request a new confirmation email, or sign in if you've already confirmed your address.",
    cta: { href: "/verify-email", label: "Send a new confirmation email" },
  },
  reset: {
    title: "This reset link isn't valid",
    body: "Password reset links work once and expire after an hour. Request a new one to continue.",
    cta: { href: "/forgot-password", label: "Request a new reset link" },
  },
  oauth: {
    title: "Google sign-in didn't complete",
    body: "The sign-in was cancelled or couldn't be verified. Try again, or use your email and password.",
    cta: { href: "/login", label: "Back to sign in" },
  },
} as const;

export default async function AuthErrorPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const c = COPY[(reason as keyof typeof COPY) ?? "link"] ?? COPY.link;
  return (
    <main className="grid min-h-dvh place-items-center px-5">
      <div className="w-full max-w-md">
        <Logo />
        <h1 className="mt-10 text-[26px]">{c.title}</h1>
        <p className="mt-3 text-muted">{c.body}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href={c.cta.href} size="lg">{c.cta.label}</ButtonLink>
          {reason !== "oauth" && <ButtonLink href="/login" variant="secondary" size="lg">Sign in</ButtonLink>}
        </div>
      </div>
    </main>
  );
}

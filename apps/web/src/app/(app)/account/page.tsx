import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { ProfileForm, EmailForm, PasswordForm, DeletionForm } from "./forms";

export const metadata: Metadata = { title: "Account" };

function Section({ id, title, description, children }: { id: string; title: string; description: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="grid gap-6 border-t border-line py-8 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
      <div>
        <h2 id={id} className="text-lg">{title}</h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

const dateFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default async function AccountPage() {
  const { profile, hasPassword } = await requireUser("/account");
  const supabase = await createClient();
  const { data: pending } = await supabase
    .from("deletion_requests").select("requested_at")
    .eq("user_id", profile.id).eq("status", "pending").maybeSingle();

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="text-[28px]">Account</h1>
      <p className="mt-1 text-muted">Manage your personal details, sign-in and data.</p>

      <div className="mt-8 rounded-[var(--radius-panel)] border border-line bg-white px-5 py-8 sm:px-8">
        <Section id="profile" title="Personal details" description="Used to pre-fill your applications. Applications you've already sent keep the details you submitted.">
          <ProfileForm defaults={{
            firstName: profile.first_name, lastName: profile.last_name, phone: profile.phone ?? "",
            address: profile.address ?? "", city: profile.city ?? "", country: profile.country ?? "",
          }} />
        </Section>

        <Section id="email" title="Email address" description="Where we send updates about your applications.">
          <EmailForm current={profile.email} />
        </Section>

        <Section id="password" title="Password" description={hasPassword ? "Changing your password signs you out on other devices." : "You sign in with Google."}>
          {hasPassword ? <PasswordForm /> : (
            <p className="text-sm text-muted">
              Your account doesn&rsquo;t have a password. To add one for signing in with email,{" "}
              <Link href="/forgot-password" className="text-ink underline underline-offset-2">set a password by email</Link>.
            </p>
          )}
        </Section>

        <Section id="delete" title="Delete your data" description="Ask us to permanently erase your account and everything you've submitted.">
          {pending
            ? <Alert tone="info">We received your deletion request on {dateFmt.format(new Date(pending.requested_at))}. We&rsquo;ll delete your data within 30 days and email you when it&rsquo;s done.</Alert>
            : <DeletionForm />}
        </Section>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { PRIVACY_POLICY_VERSION } from "@hr/shared";

export const metadata: Metadata = { title: "Privacy policy" };

// TEMPLATE: have this reviewed by your legal/privacy advisor before launch.
// If you change it materially, bump PRIVACY_POLICY_VERSION in @hr/shared.

export default async function PrivacyPage() {
  const session = await getSession();
  const c = env.companyName;
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <AppHeader profile={session?.profile ?? null} />
      <main className="mx-auto w-full max-w-[68ch] flex-1 px-4 py-12 sm:px-6 [&_h2]:mt-10 [&_h2]:text-xl [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1.5 leading-relaxed">
        <h1 className="text-[32px]">Recruitment privacy policy</h1>
        <p className="text-sm text-muted">Version {PRIVACY_POLICY_VERSION}</p>

        <h2>Who we are</h2>
        <p>{c} is the controller of the personal data you provide through this careers portal. You can contact us about your data at <a className="text-ink underline" href={`mailto:${env.privacyContact}`}>{env.privacyContact}</a>.</p>

        <h2>What we collect</h2>
        <ul>
          <li>Account details: your name, email address and sign-in information.</li>
          <li>Application details: address, city, country, phone number, the position you apply for and anything you choose to tell us.</li>
          <li>Documents you upload, such as your CV, cover letter and certificates.</li>
          <li>Notes and assessments made by our recruitment team during the hiring process.</li>
        </ul>

        <h2>Why we use it</h2>
        <p>We use your data only to assess your application, communicate with you about it and, if you&rsquo;re hired, begin onboarding. The legal bases are the steps you ask us to take before entering a contract and your consent, which you give when you submit an application.</p>

        <h2>Who can see it</h2>
        <p>Only authorised members of our HR and hiring teams. Your files are stored privately and are never public. Our service providers (hosting, database and email delivery) process data on our behalf under data processing agreements.</p>

        <h2>How long we keep it</h2>
        <p>We keep application data for as long as your account is active and for up to 12 months after a recruitment process ends, unless you ask us to delete it sooner.</p>

        <h2>Your rights</h2>
        <p>You can access and correct your details from your account at any time. You can withdraw consent and ask us to delete all your data from the Account page, and we&rsquo;ll complete the request within 30 days. You also have the right to complain to your data protection authority.</p>
      </main>
      <SiteFooter />
    </div>
  );
}

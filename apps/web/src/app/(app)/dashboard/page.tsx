import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isHrRole } from "@hr/shared";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatusBadge } from "@/components/status-badge";
import { SUMMARY_COLUMNS, positionTitle, type ApplicationSummary, type NotificationRow } from "@/lib/applications";
import { fmtDate, listJoin } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { markNotificationsRead } from "./actions";

export const metadata: Metadata = { title: "Dashboard" };

const NOTICES: Record<string, string> = {
  "password-updated": "Your password has been changed.",
  "email-confirmed": "Your email address is confirmed. Your account is ready.",
};

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { profile } = await requireUser();
  if (isHrRole(profile.role)) redirect("/hr");
  const { notice } = await searchParams;

  const supabase = await createClient();
  const [{ data: apps }, { data: notes }] = await Promise.all([
    supabase.from("applications").select(SUMMARY_COLUMNS).order("submitted_at", { ascending: false }),
    supabase.from("notifications").select("id, type, title, body, application_id, read_at, created_at")
      .order("created_at", { ascending: false }).limit(8),
  ]);
  const applications = (apps ?? []) as unknown as ApplicationSummary[];
  const notifications = (notes ?? []) as NotificationRow[];
  const unread = notifications.filter((n) => !n.read_at).length;

  const missing = [
    !profile.phone && "phone number", !profile.address && "address",
    !profile.city && "city", !profile.country && "country",
  ].filter(Boolean) as string[];

  return (
    <div className="grid gap-8">
      {notice && NOTICES[notice] && <Alert tone="success">{NOTICES[notice]}</Alert>}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px]">Welcome{profile.first_name ? `, ${profile.first_name}` : ""}</h1>
          <p className="mt-1 text-muted">Track your applications and keep your details up to date.</p>
        </div>
        <ButtonLink href="/">Browse open positions</ButtonLink>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid h-fit gap-6">
          <section aria-labelledby="apps-heading" className="rounded-[var(--radius-panel)] border border-line bg-white">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 id="apps-heading" className="text-lg">Your applications</h2>
              {applications.length > 0 && <span className="text-sm text-muted">{applications.length} total</span>}
            </div>
            {applications.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <p className="font-medium text-ink">You haven&rsquo;t applied for anything yet</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                  Pick a role from the open positions, or send an open application if you don&rsquo;t see the right one.
                </p>
                <ButtonLink href="/" variant="secondary" className="mt-5">See open positions</ButtonLink>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {applications.map((a) => (
                  <li key={a.id}>
                    <Link href={`/dashboard/applications/${a.id}`}
                      className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-mist focus-visible:bg-mist">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-ink">{positionTitle(a)}</p>
                        <p className="text-sm text-muted">{a.reference}, submitted {fmtDate(a.submitted_at)}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
          {applications.length > 0 && (
            <p className="text-sm text-muted">
              Interested in another role? <Link href="/" className="font-medium text-ink underline underline-offset-2">Apply for another position</Link>.
            </p>
          )}
        </div>

        <div className="grid h-fit gap-6">
          <section aria-labelledby="updates-heading" className="rounded-[var(--radius-panel)] border border-line bg-white">
            <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
              <h2 id="updates-heading" className="text-lg">
                Updates{unread > 0 && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 align-middle text-xs font-semibold text-white">{unread} new</span>}
              </h2>
              {unread > 0 && (
                <form action={markNotificationsRead}>
                  <SubmitButton variant="ghost" size="sm" pendingText="Marking…">Mark all as read</SubmitButton>
                </form>
              )}
            </div>
            {notifications.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">Status changes and interview invitations will appear here.</p>
            ) : (
              <ul className="divide-y divide-line">
                {notifications.map((n) => {
                  const inner = (
                    <>
                      <p className="flex items-center gap-2 text-sm font-medium text-ink">
                        {!n.read_at && <span className="size-2 shrink-0 rounded-full bg-ink" aria-label="Unread" />}
                        {n.title}
                      </p>
                      <p className="mt-0.5 text-sm text-muted">{n.body}</p>
                      <p className="mt-1 text-xs text-muted"><LocalTime iso={n.created_at} /></p>
                    </>
                  );
                  return (
                    <li key={n.id}>
                      {n.application_id
                        ? <Link href={`/dashboard/applications/${n.application_id}`} className="block px-5 py-3.5 hover:bg-mist">{inner}</Link>
                        : <div className="px-5 py-3.5">{inner}</div>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <aside aria-labelledby="profile-heading" className="rounded-[var(--radius-panel)] border border-line bg-white p-5">
            <h2 id="profile-heading" className="text-lg">Your profile</h2>
            <dl className="mt-4 grid gap-3 text-sm">
              <div><dt className="text-muted">Name</dt><dd className="font-medium text-ink">{profile.first_name} {profile.last_name}</dd></div>
              <div><dt className="text-muted">Email</dt><dd className="break-all font-medium text-ink">{profile.email}</dd></div>
              {profile.phone && <div><dt className="text-muted">Phone</dt><dd className="font-medium text-ink">{profile.phone}</dd></div>}
              {(profile.city || profile.country) && (
                <div><dt className="text-muted">Location</dt><dd className="font-medium text-ink">{[profile.city, profile.country].filter(Boolean).join(", ")}</dd></div>
              )}
            </dl>
            {missing.length > 0 && (
              <p className="mt-4 rounded-[var(--radius-control)] bg-mist px-3 py-2.5 text-sm text-muted">
                Add your {listJoin(missing)} to fill in applications faster.
              </p>
            )}
            <Link href="/account" className="mt-4 inline-block text-sm font-medium text-ink underline underline-offset-2">Edit profile</Link>
          </aside>
        </div>
      </div>
    </div>
  );
}

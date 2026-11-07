import type { Metadata } from "next";
import Link from "next/link";
import { requireHr } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/status-badge";
import { LocalTime } from "@/components/local-time";
import { DailyChart, BarList } from "@/components/hr/charts";
import { HrPanel, PageTitle } from "@/components/hr/panel";
import { HR_ROW_COLUMNS, appPosition, candidateName, type HrApplicationRow, type OverviewStats } from "@/lib/hr/types";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "HR overview" };

export default async function HrOverviewPage() {
  const { profile } = await requireHr();
  const supabase = await createClient();
  const [{ data, error }, { data: recent }, { data: ivs }] = await Promise.all([
    supabase.rpc("hr_overview_stats"),
    supabase.from("applications").select(HR_ROW_COLUMNS).order("submitted_at", { ascending: false }).limit(6),
    supabase.from("interviews")
      .select("id, scheduled_at, mode, application_id, applications(first_name, last_name, other_position, positions(title))")
      .is("cancelled_at", null).gte("scheduled_at", new Date().toISOString()).order("scheduled_at").limit(5),
  ]);
  if (error || !data) return <Alert tone="error">Statistics couldn&rsquo;t be loaded. Refresh the page to try again.</Alert>;
  const s = data as OverviewStats;
  const by = (k: keyof OverviewStats["by_status"]) => s.by_status[k] ?? 0;
  const recentApps = (recent ?? []) as unknown as HrApplicationRow[];
  type Iv = { id: string; scheduled_at: string; application_id: string;
    applications: { first_name: string; last_name: string; other_position: string | null; positions: { title: string } | null } | null };
  const interviews = (ivs ?? []) as unknown as Iv[];

  const tiles: { label: string; value: number; href?: string; note?: string }[] = [
    { label: "Candidates", value: s.total_candidates },
    { label: "Applications", value: s.total_applications, href: "/hr/applications", note: `${s.new_last_7_days} in the last 7 days` },
    { label: "New", value: s.new_applications, href: "/hr/applications?status=submitted", note: "Not yet reviewed" },
    { label: "Under review", value: by("under_review"), href: "/hr/applications?status=under_review" },
    { label: "Shortlisted", value: by("shortlisted"), href: "/hr/applications?status=shortlisted" },
    { label: "Interviews scheduled", value: by("interview_scheduled"), href: "/hr/applications?status=interview_scheduled", note: `${s.upcoming_interviews} upcoming` },
    { label: "Hired", value: by("hired"), href: "/hr/applications?status=hired" },
    { label: "Rejected", value: by("rejected"), href: "/hr/applications?status=rejected" },
  ];

  return (
    <>
      <PageTitle title="Overview" description={`Welcome back, ${profile.first_name || "there"}. Here's where recruitment stands today.`} />

      {s.pending_deletion_requests > 0 && (
        <Alert tone="info" className="mb-6">
          {s.pending_deletion_requests} data deletion {s.pending_deletion_requests === 1 ? "request needs" : "requests need"} review.{" "}
          <Link href="/hr/settings/privacy" className="font-medium underline underline-offset-2">Review requests</Link>
        </Alert>
      )}

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[var(--radius-panel)] border border-line bg-line sm:grid-cols-4">
        {tiles.map((t) => {
          const body = (
            <>
              <dt className="text-sm text-muted">{t.label}</dt>
              <dd className="mt-1 text-[26px] font-semibold leading-none tabular-nums text-ink">{t.value}</dd>
              {t.note && <dd className="mt-1.5 text-xs text-muted">{t.note}</dd>}
            </>
          );
          return t.href
            ? <Link key={t.label} href={t.href} className="bg-white px-4 py-4 hover:bg-mist sm:px-5">{body}</Link>
            : <div key={t.label} className="bg-white px-4 py-4 sm:px-5">{body}</div>;
        })}
      </dl>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <HrPanel title="Applications, last 30 days">
          <div className="px-5 py-4"><DailyChart data={s.daily_last_30_days} /></div>
        </HrPanel>
        <HrPanel title="By position">
          <div className="px-5 py-4">
            {s.by_position.length
              ? <BarList items={s.by_position.map((p) => ({ label: p.title, value: p.n, href: `/hr/applications?position=${p.id ?? "other"}` }))} />
              : <p className="text-sm text-muted">No applications yet.</p>}
          </div>
        </HrPanel>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <HrPanel title="Latest applications" action={<Link href="/hr/applications" className="text-sm font-medium text-steel hover:text-ink">View all</Link>}>
          {recentApps.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No applications yet.</p> : (
            <ul className="divide-y divide-line">
              {recentApps.map((a) => (
                <li key={a.id}>
                  <Link href={`/hr/applications/${a.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-mist">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{candidateName(a)}</p>
                      <p className="truncate text-xs text-muted">{appPosition(a)}, {fmtDate(a.submitted_at)}</p>
                    </div>
                    <StatusBadge status={a.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </HrPanel>
        <HrPanel title="Upcoming interviews">
          {interviews.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No interviews scheduled.</p> : (
            <ul className="divide-y divide-line">
              {interviews.map((iv) => (
                <li key={iv.id}>
                  <Link href={`/hr/applications/${iv.application_id}`} className="block px-5 py-3 hover:bg-mist">
                    <p className="text-sm font-medium text-ink">{iv.applications ? candidateName(iv.applications) : "Candidate"}</p>
                    <p className="text-xs text-muted"><LocalTime iso={iv.scheduled_at} />, {iv.applications ? appPosition(iv.applications) : ""}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </HrPanel>
      </div>
    </>
  );
}

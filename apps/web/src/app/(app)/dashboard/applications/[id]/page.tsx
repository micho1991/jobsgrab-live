import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STATUS_META, isTerminalStatus } from "@hr/shared";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { StatusBadge } from "@/components/status-badge";
import {
  DETAIL_COLUMNS, DOCUMENT_COLUMNS, INTERVIEW_COLUMNS, positionTitle,
  type ApplicationDetail, type DocumentRow, type HistoryRow, type InterviewRow,
} from "@/lib/applications";
import { UUID_RE, fmtDate } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { ApplicationProgress } from "./progress";
import { DocumentsPanel } from "./documents-panel";

export const metadata: Metadata = { title: "Application" };

const MODE = { in_person: "In person", video: "Video call", phone: "Phone call" } as const;

function Panel({ title, children, id, className = "" }: { title: string; id: string; children: React.ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={`rounded-[var(--radius-panel)] border border-line bg-white p-5 sm:p-6 ${className}`}>
      <h2 id={id} className="mb-4 text-lg">{title}</h2>
      {children}
    </section>
  );
}

export default async function ApplicationPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }>;
}) {
  const { id } = await params;
  const { notice } = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const { user } = await requireUser(`/dashboard/applications/${id}`);
  const supabase = await createClient();

  // RLS returns nothing for applications that aren't the user's own.
  const [{ data: app }, { data: docs }, { data: hist }, { data: ivs }] = await Promise.all([
    supabase.from("applications").select(DETAIL_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("documents").select(DOCUMENT_COLUMNS).eq("application_id", id).is("replaced_at", null).order("created_at"),
    supabase.from("application_status_history").select("to_status, created_at").eq("application_id", id).order("created_at"),
    supabase.from("interviews").select(INTERVIEW_COLUMNS).eq("application_id", id).order("scheduled_at"),
  ]);
  if (!app) notFound();
  const a = app as unknown as ApplicationDetail;
  const history = (hist ?? []) as HistoryRow[];
  const interviews = (ivs ?? []) as InterviewRow[];
  const upcoming = interviews.filter((i) => !i.cancelled_at && new Date(i.scheduled_at) > new Date());

  return (
    <div className="grid gap-6">
      {notice === "submitted" && (
        <Alert tone="success">
          Your application has been submitted. We&rsquo;ve emailed you a confirmation, and you&rsquo;ll hear from us whenever its status changes.
        </Alert>
      )}

      <div>
        <Link href="/dashboard" className="text-sm font-medium text-steel hover:text-ink">Back to dashboard</Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[28px]">{positionTitle(a)}</h1>
            <p className="mt-1 text-muted">Reference {a.reference}, submitted {fmtDate(a.submitted_at)}</p>
          </div>
          <StatusBadge status={a.status} />
        </div>
      </div>

      <Panel id="progress-h" title="Progress">
        <ApplicationProgress status={a.status} history={history} />
        <p className="mt-5 border-t border-line pt-4 text-sm text-muted">{STATUS_META[a.status].candidateHint}</p>
      </Panel>

      {upcoming.map((iv) => (
        <section key={iv.id} aria-label="Upcoming interview" className="rounded-[var(--radius-panel)] border border-ink/20 bg-info-bg p-5 sm:p-6">
          <h2 className="text-lg">Your interview</h2>
          <dl className="mt-3 grid gap-x-8 gap-y-2 text-sm sm:grid-cols-2">
            <div><dt className="text-muted">When</dt><dd className="font-medium text-ink"><LocalTime iso={iv.scheduled_at} format="long" /></dd></div>
            <div><dt className="text-muted">Format</dt><dd className="font-medium text-ink">{MODE[iv.mode]}, {iv.duration_minutes} minutes</dd></div>
            {iv.location && <div><dt className="text-muted">Location</dt><dd className="font-medium text-ink">{iv.location}</dd></div>}
            {iv.meeting_url && (
              <div><dt className="text-muted">Meeting link</dt>
                <dd><a href={iv.meeting_url} target="_blank" rel="noopener noreferrer" className="break-all font-medium text-ink underline underline-offset-2">{iv.meeting_url}</a></dd></div>
            )}
          </dl>
          {iv.details_for_candidate && <p className="mt-3 whitespace-pre-line text-sm">{iv.details_for_candidate}</p>}
        </section>
      ))}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="grid gap-6">
          <Panel id="docs-h" title="Documents">
            <DocumentsPanel applicationId={a.id} userId={user.id} documents={(docs ?? []) as DocumentRow[]} locked={isTerminalStatus(a.status)} />
          </Panel>

          <Panel id="details-h" title="What you submitted">
            <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Name</dt><dd className="text-ink">{a.first_name} {a.last_name}</dd></div>
              <div><dt className="text-muted">Email</dt><dd className="break-all text-ink">{a.email}</dd></div>
              <div><dt className="text-muted">Phone</dt><dd className="text-ink">{a.phone}</dd></div>
              <div><dt className="text-muted">Address</dt><dd className="text-ink">{a.address}, {a.city}, {a.country}</dd></div>
              <div className="sm:col-span-2"><dt className="text-muted">Additional information</dt>
                <dd className="mt-0.5 whitespace-pre-line text-ink">{a.additional_info || "None"}</dd></div>
            </dl>
            <p className="mt-5 border-t border-line pt-4 text-xs text-muted">
              You confirmed your details were accurate and accepted privacy policy version {a.privacy_policy_version} on <LocalTime iso={a.consented_at} />.
            </p>
          </Panel>
        </div>

        <Panel id="history-h" title="History" className="h-fit">
          <ol className="relative grid gap-5 border-l border-line pl-5">
            {[...history].reverse().map((h, i) => (
              <li key={`${h.to_status}-${h.created_at}`} className="relative">
                <span aria-hidden="true" className={`absolute -left-[25px] top-1.5 size-2.5 rounded-full ${i === 0 ? "bg-ink" : "bg-steel-light"}`} />
                <p className="text-sm font-medium text-ink">{h.to_status === "submitted" ? "Application submitted" : `Moved to ${STATUS_META[h.to_status].label}`}</p>
                <p className="text-xs text-muted"><LocalTime iso={h.created_at} /></p>
              </li>
            ))}
            {interviews.filter((i) => i.cancelled_at).map((i) => (
              <li key={i.id} className="relative">
                <span aria-hidden="true" className="absolute -left-[25px] top-1.5 size-2.5 rounded-full bg-steel-light" />
                <p className="text-sm font-medium text-ink">Interview on {fmtDate(i.scheduled_at)} cancelled</p>
                <p className="text-xs text-muted"><LocalTime iso={i.cancelled_at!} /></p>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </div>
  );
}

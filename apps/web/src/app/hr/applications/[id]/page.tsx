import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { STATUS_META } from "@hr/shared";
import { requireHr } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { LocalTime } from "@/components/local-time";
import { HrPanel } from "@/components/hr/panel";
import { INTERVIEW_COLUMNS, type ApplicationDetail, type InterviewRow } from "@/lib/applications";
import { appPosition, candidateName, type HrDocument, type HrHistory, type HrNote } from "@/lib/hr/types";
import { can, ROLE_LABEL } from "@/lib/hr/permissions";
import { UUID_RE, fmtDate } from "@/lib/format";
import { StatusControl } from "./status-control";
import { NotesPanel } from "./notes-panel";
import { InterviewsPanel } from "./interviews-panel";
import { HrDocuments } from "./hr-documents";

export const metadata: Metadata = { title: "Application" };

type HrDetail = ApplicationDetail & { candidate_id: string; position_id: string | null };

export default async function HrApplicationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { user, profile } = await requireHr();
  const perms = can(profile.role);
  const supabase = await createClient();

  const { data: app } = await supabase.from("applications")
    .select("id, reference, status, submitted_at, status_changed_at, candidate_id, position_id, other_position, first_name, last_name, email, phone, address, city, country, additional_info, consented_at, privacy_policy_version, positions(title, department, location)")
    .eq("id", id).maybeSingle();
  if (!app) notFound();
  const a = app as unknown as HrDetail;

  const [{ data: docs }, { data: notes }, { data: hist }, { data: ivs }, { data: others }] = await Promise.all([
    supabase.from("documents").select("id, kind, file_name, size_bytes, created_at, replaced_at").eq("application_id", id).order("created_at"),
    supabase.from("application_notes").select("id, body, created_at, updated_at, author_id, author:profiles(first_name, last_name)")
      .eq("application_id", id).order("created_at", { ascending: false }),
    supabase.from("application_status_history").select("id, from_status, to_status, created_at, changed_by, actor:profiles(first_name, last_name, role)")
      .eq("application_id", id).order("created_at", { ascending: false }),
    supabase.from("interviews").select(INTERVIEW_COLUMNS).eq("application_id", id).order("scheduled_at", { ascending: false }),
    supabase.from("applications").select("id, reference, status, submitted_at, other_position, positions(title)")
      .eq("candidate_id", a.candidate_id).neq("id", id).order("submitted_at", { ascending: false }),
  ]);
  const history = (hist ?? []) as unknown as HrHistory[];
  type Other = { id: string; reference: string; status: HrDetail["status"]; submitted_at: string; other_position: string | null; positions: { title: string } | null };
  const otherApps = (others ?? []) as unknown as Other[];

  return (
    <>
      <div className="mb-6">
        <Link href="/hr/applications" className="text-sm font-medium text-steel hover:text-ink">All applications</Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[26px]">{candidateName(a)}</h1>
            <p className="mt-1 text-sm text-muted">
              {appPosition(a)}, {a.reference}, submitted {fmtDate(a.submitted_at)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge status={a.status} />
            <Link href={`/hr/candidates/${a.candidate_id}`} className="text-sm font-medium text-ink underline underline-offset-2">Candidate profile</Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid h-fit gap-6">
          {perms.manageApplications && (
            <HrPanel title="Stage">
              <div className="p-5"><StatusControl applicationId={a.id} status={a.status} firstName={a.first_name} /></div>
            </HrPanel>
          )}

          <HrPanel title="Candidate details">
            <dl className="grid gap-x-8 gap-y-3 p-5 text-sm sm:grid-cols-2">
              <div><dt className="text-muted">Email</dt><dd><a href={`mailto:${a.email}`} className="break-all text-ink underline-offset-2 hover:underline">{a.email}</a></dd></div>
              <div><dt className="text-muted">Phone</dt><dd><a href={`tel:${a.phone.replace(/[^+\d]/g, "")}`} className="text-ink underline-offset-2 hover:underline">{a.phone}</a></dd></div>
              <div className="sm:col-span-2"><dt className="text-muted">Address</dt><dd className="text-ink">{a.address}, {a.city}, {a.country}</dd></div>
              <div className="sm:col-span-2">
                <dt className="text-muted">Anything else they want us to know</dt>
                <dd className="mt-0.5 whitespace-pre-line text-ink">{a.additional_info || <span className="text-muted">Nothing added</span>}</dd>
              </div>
              <div className="border-t border-line pt-3 text-xs text-muted sm:col-span-2">
                Confirmed accuracy and consented to privacy policy v{a.privacy_policy_version} on <LocalTime iso={a.consented_at} />.
              </div>
            </dl>
          </HrPanel>

          <HrPanel title="Documents"><HrDocuments documents={(docs ?? []) as HrDocument[]} /></HrPanel>

          <HrPanel title="Interviews">
            <InterviewsPanel applicationId={a.id} interviews={(ivs ?? []) as InterviewRow[]} canWrite={perms.manageApplications} firstName={a.first_name} />
          </HrPanel>
        </div>

        <div className="grid h-fit gap-6">
          <HrPanel title="Internal notes">
            <NotesPanel applicationId={a.id} notes={(notes ?? []) as unknown as HrNote[]} userId={user.id}
              canWrite={perms.manageApplications} isAdmin={profile.role === "hr_admin"} />
          </HrPanel>

          <HrPanel title="History">
            <ol className="relative mx-5 my-5 grid gap-4 border-l border-line pl-5">
              {history.map((h, i) => (
                <li key={h.id} className="relative">
                  <span aria-hidden="true" className={`absolute -left-[25px] top-1.5 size-2.5 rounded-full ${i === 0 ? "bg-ink" : "bg-steel-light"}`} />
                  <p className="text-sm font-medium text-ink">
                    {h.from_status ? `${STATUS_META[h.from_status].label} to ${STATUS_META[h.to_status].label}` : "Application submitted"}
                  </p>
                  <p className="text-xs text-muted">
                    <LocalTime iso={h.created_at} />
                    {h.actor && h.from_status && `, by ${h.actor.first_name} ${h.actor.last_name}`}
                    {h.actor && h.from_status && h.actor.role !== "candidate" && ` (${ROLE_LABEL[h.actor.role]})`}
                  </p>
                </li>
              ))}
            </ol>
          </HrPanel>

          <HrPanel title="Other applications from this candidate">
            {otherApps.length === 0 ? <p className="px-5 py-4 text-sm text-muted">None.</p> : (
              <ul className="divide-y divide-line">
                {otherApps.map((o) => (
                  <li key={o.id}>
                    <Link href={`/hr/applications/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-mist">
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{appPosition(o)}</span>
                        <span className="block text-xs text-muted">{o.reference}, {fmtDate(o.submitted_at)}</span>
                      </span>
                      <StatusBadge status={o.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </HrPanel>
        </div>
      </div>
    </>
  );
}

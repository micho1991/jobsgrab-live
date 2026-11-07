import type { Metadata } from "next";
import Link from "next/link";
import { APPLICATION_STATUSES, type ApplicationStatus } from "@hr/shared";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { FilterBar } from "@/components/hr/filter-bar";
import { HrPanel, PageTitle } from "@/components/hr/panel";
import { HR_ROW_COLUMNS, appPosition, candidateName, type HrApplicationRow } from "@/lib/hr/types";
import { UUID_RE, fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Applications" };

const PAGE_SIZE = 25;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SORTS = {
  newest: { col: "submitted_at", asc: false, label: "Newest first" },
  oldest: { col: "submitted_at", asc: true, label: "Oldest first" },
  name: { col: "last_name", asc: true, label: "Last name" },
  updated: { col: "status_changed_at", asc: false, label: "Recently updated" },
} as const;

type SP = Record<string, string | undefined>;

export default async function HrApplicationsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const sort = SORTS[(sp.sort as keyof typeof SORTS) ?? "newest"] ?? SORTS.newest;
  const supabase = await createClient();

  let q = supabase.from("applications").select(HR_ROW_COLUMNS, { count: "exact" });
  if (sp.q) {
    const term = sp.q.toLowerCase().replace(/[\\%_]/g, (c) => `\\${c}`).slice(0, 100);
    q = q.ilike("search_text", `%${term}%`);
  }
  if (sp.position === "other") q = q.is("position_id", null);
  else if (sp.position && UUID_RE.test(sp.position)) q = q.eq("position_id", sp.position);
  if (sp.status && (APPLICATION_STATUSES as readonly string[]).includes(sp.status)) q = q.eq("status", sp.status as ApplicationStatus);
  if (sp.from && DATE_RE.test(sp.from)) q = q.gte("submitted_at", `${sp.from}T00:00:00`);
  if (sp.to && DATE_RE.test(sp.to)) {
    const end = new Date(`${sp.to}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 1);
    q = q.lt("submitted_at", end.toISOString());
  }
  q = q.order(sort.col, { ascending: sort.asc }).order("id").range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  const [{ data, count, error }, { data: positions }] = await Promise.all([
    q, supabase.from("positions").select("id, title").order("title"),
  ]);
  const rows = (data ?? []) as unknown as HrApplicationRow[];
  const total = count ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const link = (changes: SP) => {
    const p = new URLSearchParams(Object.entries({ ...sp, ...changes }).filter(([, v]) => v) as [string, string][]);
    return `/hr/applications?${p.toString()}`;
  };

  return (
    <>
      <PageTitle title="Applications" description={`${total} ${total === 1 ? "application" : "applications"} match these filters`} />
      <HrPanel>
        <div className="border-b border-line px-5 py-4"><FilterBar positions={positions ?? []} /></div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-b border-line px-5 py-2 text-sm">
          <span className="text-muted">Sort:</span>
          {Object.entries(SORTS).map(([k, v]) => (
            <Link key={k} href={link({ sort: k, page: undefined })} aria-current={v === sort ? "true" : undefined}
              className={`rounded-md px-2 py-1 ${v === sort ? "bg-mist font-medium text-ink" : "text-muted hover:text-ink"}`}>{v.label}</Link>
          ))}
        </div>
        {error ? <p className="px-5 py-8 text-sm text-bad">Applications couldn&rsquo;t be loaded. Refresh to try again.</p>
        : rows.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="font-medium text-ink">No applications match</p>
            <p className="mt-1 text-sm text-muted">Try a different search or clear the filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="px-5 py-2.5 font-medium">Candidate</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Position</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Location</th>
                  <th scope="col" className="px-3 py-2.5 font-medium">Submitted</th>
                  <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((a) => (
                  <tr key={a.id} className="group relative hover:bg-mist">
                    <td className="px-5 py-3">
                      <Link href={`/hr/applications/${a.id}`} className="font-medium text-ink after:absolute after:inset-0 group-hover:underline">
                        {candidateName(a)}
                      </Link>
                      <div className="text-xs text-muted">{a.email}</div>
                    </td>
                    <td className="max-w-[260px] truncate px-3 py-3 text-body">{appPosition(a)}</td>
                    <td className="px-3 py-3 text-muted">{a.city}, {a.country}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">{fmtDate(a.submitted_at)}</td>
                    <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <nav aria-label="Pagination" className="flex items-center justify-between border-t border-line px-5 py-3 text-sm">
            <span className="text-muted">Page {page} of {pages}</span>
            <div className="flex gap-2">
              {page > 1 && <Link href={link({ page: String(page - 1) })} className="rounded-md border border-line px-3 py-1.5 hover:bg-mist">Previous</Link>}
              {page < pages && <Link href={link({ page: String(page + 1) })} className="rounded-md border border-line px-3 py-1.5 hover:bg-mist">Next</Link>}
            </div>
          </nav>
        )}
      </HrPanel>
    </>
  );
}

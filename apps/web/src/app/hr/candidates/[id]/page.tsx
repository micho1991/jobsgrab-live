import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireHr } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { StatusBadge } from "@/components/status-badge";
import { HrPanel } from "@/components/hr/panel";
import { appPosition, type HrApplicationRow, HR_ROW_COLUMNS } from "@/lib/hr/types";
import { UUID_RE, fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Candidate" };

export default async function CandidatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  await requireHr();
  const supabase = await createClient();
  const [{ data: p }, { data: apps }] = await Promise.all([
    supabase.from("profiles").select("id, email, first_name, last_name, phone, address, city, country, role, created_at").eq("id", id).maybeSingle(),
    supabase.from("applications").select(HR_ROW_COLUMNS).eq("candidate_id", id).order("submitted_at", { ascending: false }),
  ]);
  if (!p) notFound();
  const applications = (apps ?? []) as unknown as HrApplicationRow[];

  return (
    <>
      <div className="mb-6">
        <Link href="/hr/applications" className="text-sm font-medium text-steel hover:text-ink">All applications</Link>
        <h1 className="mt-2 text-[26px]">{p.first_name} {p.last_name}</h1>
        <p className="mt-1 text-sm text-muted">Registered {fmtDate(p.created_at)}</p>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <HrPanel title="Profile" className="h-fit">
          <dl className="grid gap-3 p-5 text-sm">
            <div><dt className="text-muted">Email</dt><dd><a href={`mailto:${p.email}`} className="break-all text-ink hover:underline">{p.email}</a></dd></div>
            <div><dt className="text-muted">Phone</dt><dd className="text-ink">{p.phone || <span className="text-muted">Not provided</span>}</dd></div>
            <div><dt className="text-muted">Address</dt><dd className="text-ink">{[p.address, p.city, p.country].filter(Boolean).join(", ") || <span className="text-muted">Not provided</span>}</dd></div>
          </dl>
          <p className="border-t border-line px-5 py-3 text-xs text-muted">Profile details are kept up to date by the candidate. Each application keeps the details submitted with it.</p>
        </HrPanel>
        <HrPanel title={`Application history (${applications.length})`} className="h-fit">
          {applications.length === 0 ? <p className="px-5 py-4 text-sm text-muted">No applications yet.</p> : (
            <ul className="divide-y divide-line">
              {applications.map((a) => (
                <li key={a.id}>
                  <Link href={`/hr/applications/${a.id}`} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 hover:bg-mist">
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">{appPosition(a)}</span>
                      <span className="block text-xs text-muted">{a.reference}, submitted {fmtDate(a.submitted_at)}</span>
                    </span>
                    <StatusBadge status={a.status} />
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

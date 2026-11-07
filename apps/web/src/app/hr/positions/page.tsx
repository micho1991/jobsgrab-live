import type { Metadata } from "next";
import Link from "next/link";
import { requireHr } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { HrPanel, PageTitle } from "@/components/hr/panel";
import { can } from "@/lib/hr/permissions";
import { employmentLabel } from "@/lib/positions";
import { fmtDate } from "@/lib/format";
import type { EmploymentType } from "@hr/shared";
import { setPositionFlag } from "./actions";

export const metadata: Metadata = { title: "Positions" };

interface Row {
  id: string; title: string; department: string | null; location: string | null; employment_type: EmploymentType;
  application_deadline: string | null; status: "open" | "closed"; is_active: boolean; applications: { count: number }[];
}

function visibility(p: Row) {
  const today = new Date().toISOString().slice(0, 10);
  if (!p.is_active) return { label: "Inactive", tone: "bg-slate-100 text-slate-700" };
  if (p.status === "closed") return { label: "Closed", tone: "bg-slate-100 text-slate-700" };
  if (p.application_deadline && p.application_deadline < today) return { label: "Deadline passed", tone: "bg-amber-100 text-amber-900" };
  return { label: "Live on job board", tone: "bg-ok-bg text-ok" };
}

export default async function PositionsPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { saved } = await searchParams;
  const { profile } = await requireHr();
  const admin = can(profile.role).managePositions;
  const supabase = await createClient();
  const { data } = await supabase.from("positions")
    .select("id, title, department, location, employment_type, application_deadline, status, is_active, applications(count)")
    .order("is_active", { ascending: false }).order("created_at", { ascending: false });
  const rows = (data ?? []) as unknown as Row[];

  const Toggle = ({ p, field, value, label }: { p: Row; field: string; value: string; label: string }) => (
    <form action={setPositionFlag}>
      <input type="hidden" name="id" value={p.id} /><input type="hidden" name="field" value={field} /><input type="hidden" name="value" value={value} />
      <button className="text-xs font-medium text-steel hover:text-ink">{label}</button>
    </form>
  );

  return (
    <>
      <PageTitle title="Positions" description="Only active, open positions before their deadline appear in the application form."
        actions={admin && <ButtonLink href="/hr/positions/new">New position</ButtonLink>} />
      {saved && <Alert tone="success" className="mb-4">Saved &ldquo;{saved}&rdquo;.</Alert>}
      {!admin && <Alert tone="info" className="mb-4">Only HR admins can create or change positions.</Alert>}
      <HrPanel>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="text-xs text-muted">
              <tr className="border-b border-line">
                <th scope="col" className="px-5 py-2.5 font-medium">Position</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Deadline</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Applications</th>
                <th scope="col" className="px-3 py-2.5 font-medium">Visibility</th>
                {admin && <th scope="col" className="px-5 py-2.5 font-medium"><span className="sr-only">Actions</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((p) => {
                const vis = visibility(p);
                const n = p.applications[0]?.count ?? 0;
                return (
                  <tr key={p.id} className={p.is_active ? "" : "bg-mist/50"}>
                    <td className="px-5 py-3">
                      {admin ? <Link href={`/hr/positions/${p.id}`} className="font-medium text-ink hover:underline">{p.title}</Link>
                        : <span className="font-medium text-ink">{p.title}</span>}
                      <div className="text-xs text-muted">{[p.department, p.location, employmentLabel(p.employment_type)].filter(Boolean).join(", ")}</div>
                    </td>
                    <td className="whitespace-nowrap px-3 py-3 text-muted">{p.application_deadline ? fmtDate(p.application_deadline) : "None"}</td>
                    <td className="px-3 py-3">
                      {n > 0 ? <Link href={`/hr/applications?position=${p.id}`} className="tabular-nums text-ink underline-offset-2 hover:underline">{n}</Link>
                        : <span className="text-muted">0</span>}
                    </td>
                    <td className="px-3 py-3"><span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[13px] font-medium ${vis.tone}`}>{vis.label}</span></td>
                    {admin && (
                      <td className="px-5 py-3">
                        <div className="flex flex-wrap justify-end gap-x-4 gap-y-1">
                          {p.status === "open" ? <Toggle p={p} field="status" value="closed" label="Close" /> : <Toggle p={p} field="status" value="open" label="Reopen" />}
                          {p.is_active ? <Toggle p={p} field="is_active" value="false" label="Deactivate" /> : <Toggle p={p} field="is_active" value="true" label="Activate" />}
                          <Link href={`/hr/positions/${p.id}`} className="text-xs font-medium text-steel hover:text-ink">Edit</Link>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length === 0 && <p className="px-5 py-8 text-center text-sm text-muted">No positions yet.</p>}
      </HrPanel>
    </>
  );
}

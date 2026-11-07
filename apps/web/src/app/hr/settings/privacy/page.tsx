import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireHr } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HrPanel, PageTitle } from "@/components/hr/panel";
import { LocalTime } from "@/components/local-time";
import { can } from "@/lib/hr/permissions";
import { fmtDate } from "@/lib/format";
import { RequestActions } from "./requests";

export const metadata: Metadata = { title: "Privacy requests" };

interface Req {
  id: string; reason: string | null; status: "pending" | "completed" | "rejected"; requested_at: string; processed_at: string | null;
  admin_note: string | null;
  user: { first_name: string; last_name: string; email: string } | null;
}

export default async function PrivacyRequestsPage() {
  const { profile } = await requireHr();
  if (!can(profile.role).managePrivacy) redirect("/hr");
  const supabase = await createClient();
  const { data } = await supabase.from("deletion_requests")
    .select("id, reason, status, requested_at, processed_at, admin_note, user:profiles!deletion_requests_user_id_fkey(first_name, last_name, email)")
    .order("requested_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as unknown as Req[];
  const pending = rows.filter((r) => r.status === "pending");
  const done = rows.filter((r) => r.status !== "pending");
  const daysLeft = (iso: string) => 30 - Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);

  return (
    <div className="grid max-w-4xl gap-6">
      <PageTitle title="Privacy requests" description="Candidates can ask for their data to be deleted. GDPR requires a response within one month." />
      <HrPanel title={`Waiting for review (${pending.length})`}>
        {pending.length === 0 ? <p className="px-5 py-6 text-sm text-muted">No requests waiting.</p> : (
          <ul className="divide-y divide-line">
            {pending.map((r) => {
              const name = r.user ? `${r.user.first_name} ${r.user.last_name}` : "Unknown user";
              const left = daysLeft(r.requested_at);
              return (
                <li key={r.id} className="grid gap-3 px-5 py-4">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <p className="font-medium text-ink">{name}</p>
                      <p className="text-sm text-muted">{r.user?.email}</p>
                    </div>
                    <p className={`text-sm ${left <= 7 ? "font-medium text-bad" : "text-muted"}`}>
                      Requested <LocalTime iso={r.requested_at} />, {left > 0 ? `${left} days left` : "overdue"}
                    </p>
                  </div>
                  {r.reason && <p className="rounded-[var(--radius-control)] bg-mist px-3 py-2 text-sm">&ldquo;{r.reason}&rdquo;</p>}
                  <RequestActions id={r.id} name={name} />
                </li>
              );
            })}
          </ul>
        )}
      </HrPanel>
      <HrPanel title="Processed">
        {done.length === 0 ? <p className="px-5 py-6 text-sm text-muted">Nothing processed yet.</p> : (
          <ul className="divide-y divide-line text-sm">
            {done.map((r) => (
              <li key={r.id} className="flex flex-wrap justify-between gap-2 px-5 py-3">
                <span className="text-ink">{r.status === "completed" ? "Data deleted" : `Rejected${r.admin_note ? `: ${r.admin_note}` : ""}`}</span>
                <span className="text-muted">Requested {fmtDate(r.requested_at)}, processed {r.processed_at ? fmtDate(r.processed_at) : ""}</span>
              </li>
            ))}
          </ul>
        )}
        <p className="border-t border-line px-5 py-3 text-xs text-muted">Completed requests keep no personal details, only the dates, as a record that the request was handled.</p>
      </HrPanel>
    </div>
  );
}

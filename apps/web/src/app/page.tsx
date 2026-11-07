import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { SiteFooter } from "@/components/site-footer";
import { buttonClass } from "@/components/ui/button";
import { getSession } from "@/lib/auth";
import { env } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { POSITION_COLUMNS, deadlineLabel, employmentLabel, type PositionRow } from "@/lib/positions";

export const dynamic = "force-dynamic";

export default async function JobBoardPage() {
  const session = await getSession();
  const supabase = await createClient();
  // RLS returns only active, open positions whose deadline hasn't passed
  // (HR staff see everything, so filter explicitly here too).
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("positions")
    .select(POSITION_COLUMNS)
    .eq("is_active", true).eq("status", "open")
    .or(`application_deadline.is.null,application_deadline.gte.${today}`)
    .order("created_at", { ascending: false });
  const positions = (data ?? []) as PositionRow[];

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <AppHeader profile={session?.profile ?? null} />

      <main className="flex-1">
        <section className="border-b border-line bg-mist">
          <div className="mx-auto max-w-6xl px-4 pb-10 pt-12 sm:px-6 sm:pb-14 sm:pt-16">
            <h1 className="max-w-2xl text-[34px] leading-[1.12] tracking-[-0.025em] sm:text-[44px]">
              Open positions at {env.companyName}
            </h1>
            <p className="mt-4 max-w-xl text-[17px] text-muted">
              Apply online in a few minutes, then follow your application from your dashboard.
              We email you whenever its status changes.
            </p>
          </div>
        </section>

        <section aria-labelledby="positions-heading" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="mb-4 flex items-baseline justify-between gap-4">
            <h2 id="positions-heading" className="text-lg">
              {error ? "Positions" : `${positions.length} ${positions.length === 1 ? "position" : "positions"} open`}
            </h2>
          </div>

          {error ? (
            <p className="rounded-[var(--radius-panel)] border border-line px-5 py-8 text-muted">
              Positions couldn&rsquo;t be loaded right now. Refresh the page in a moment.
            </p>
          ) : positions.length === 0 ? (
            <p className="rounded-[var(--radius-panel)] border border-line px-5 py-8 text-muted">
              There are no open positions at the moment. You can still send an open application below.
            </p>
          ) : (
            <ul className="divide-y divide-line border-y border-line">
              {positions.map((p) => {
                const deadline = deadlineLabel(p.application_deadline);
                return (
                  <li key={p.id}>
                    <details className="group">
                      <summary className="grid cursor-pointer list-none gap-x-6 gap-y-2 py-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center [&::-webkit-details-marker]:hidden">
                        <div className="min-w-0">
                          <h3 className="text-[18px] font-semibold text-ink group-hover:underline group-hover:underline-offset-4">{p.title}</h3>
                          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
                            {p.department && <span>{p.department}</span>}
                            {p.location && <span>{p.location}</span>}
                            <span>{employmentLabel(p.employment_type)}</span>
                            {deadline && <span className="text-ink">{deadline}</span>}
                          </p>
                        </div>
                        <span className="text-sm font-medium text-steel">
                          <span className="group-open:hidden">Show details</span>
                          <span className="hidden group-open:inline">Hide details</span>
                        </span>
                      </summary>
                      <div className="pb-6 sm:pr-40">
                        {p.description && <p className="max-w-[70ch] whitespace-pre-line text-body">{p.description}</p>}
                        <Link href={`/apply/${p.id}`} className={buttonClass("primary", "md", "mt-5")}>Apply for this position</Link>
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-panel)] bg-mist px-5 py-5 sm:px-6">
            <div>
              <p className="font-medium text-ink">Don&rsquo;t see the right role?</p>
              <p className="text-sm text-muted">Send an open application and tell us what you&rsquo;re looking for.</p>
            </div>
            <Link href="/apply/other" className={buttonClass("secondary")}>Send an open application</Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

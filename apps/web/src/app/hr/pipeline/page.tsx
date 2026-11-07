import type { Metadata } from "next";
import Link from "next/link";
import { requireHr } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageTitle } from "@/components/hr/panel";
import { can } from "@/lib/hr/permissions";
import { appPosition, candidateName } from "@/lib/hr/types";
import { UUID_RE } from "@/lib/format";
import { PipelineBoard, type Card } from "./board";

export const metadata: Metadata = { title: "Pipeline" };

export default async function PipelinePage({ searchParams }: { searchParams: Promise<{ position?: string }> }) {
  const { position } = await searchParams;
  const { profile } = await requireHr();
  const supabase = await createClient();

  let q = supabase.from("applications")
    .select("id, status, status_changed_at, first_name, last_name, other_position, positions(title)")
    .order("status_changed_at", { ascending: false }).limit(500);
  if (position === "other") q = q.is("position_id", null);
  else if (position && UUID_RE.test(position)) q = q.eq("position_id", position);
  const [{ data }, { data: positions }] = await Promise.all([q, supabase.from("positions").select("id, title").order("title")]);

  type Row = { id: string; status: Card["status"]; status_changed_at: string; first_name: string; last_name: string; other_position: string | null; positions: { title: string } | null };
  const cards: Card[] = ((data ?? []) as unknown as Row[]).map((r) => ({
    id: r.id, name: candidateName(r), position: appPosition(r), status: r.status, status_changed_at: r.status_changed_at,
  }));
  const canMove = can(profile.role).manageApplications;
  const chip = (href: string, label: string, on: boolean) => (
    <Link key={href} href={href} aria-current={on ? "true" : undefined}
      className={`whitespace-nowrap rounded-full border px-3 py-1 text-sm ${on ? "border-ink bg-ink text-white" : "border-line bg-white text-body hover:border-steel-light"}`}>{label}</Link>
  );

  return (
    <>
      <PageTitle title="Pipeline"
        description={canMove
          ? "Drag a card, or use its Move to menu, to change the stage. The candidate is emailed about each move."
          : "You have view-only access, so stages can't be changed here."} />
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1" aria-label="Filter by position">
        {chip("/hr/pipeline", "All positions", !position)}
        {(positions ?? []).map((p) => chip(`/hr/pipeline?position=${p.id}`, p.title, position === p.id))}
        {chip("/hr/pipeline?position=other", "Other", position === "other")}
      </div>
      <PipelineBoard initial={cards} canMove={canMove} />
    </>
  );
}

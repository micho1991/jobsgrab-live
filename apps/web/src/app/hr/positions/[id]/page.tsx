import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireHr } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can } from "@/lib/hr/permissions";
import { HrPanel, PageTitle } from "@/components/hr/panel";
import { Button } from "@/components/ui/button";
import { UUID_RE } from "@/lib/format";
import { PositionForm } from "../position-form";
import { deletePosition } from "../actions";

export const metadata: Metadata = { title: "Edit position" };

export default async function EditPositionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { profile } = await requireHr();
  if (!can(profile.role).managePositions) redirect("/hr/positions");
  const supabase = await createClient();
  const { data: p } = await supabase.from("positions")
    .select("id, title, department, location, employment_type, description, application_deadline, status, is_active, applications(count)")
    .eq("id", id).maybeSingle();
  if (!p) notFound();
  const count = (p.applications as unknown as { count: number }[])[0]?.count ?? 0;

  return (
    <div className="max-w-3xl">
      <PageTitle title="Edit position" description={`${count} ${count === 1 ? "application" : "applications"} received`} />
      <HrPanel><div className="p-5 sm:p-6">
        <PositionForm defaults={{
          id: p.id, title: p.title, department: p.department ?? "", location: p.location ?? "", employmentType: p.employment_type,
          description: p.description, applicationDeadline: p.application_deadline ?? "", status: p.status, isActive: p.is_active,
        }} />
      </div></HrPanel>
      <HrPanel title="Delete position" className="mt-6">
        <div className="p-5 text-sm">
          {count > 0 ? (
            <p className="text-muted">This position has applications, so it can&rsquo;t be deleted. Deactivate it instead to hide it while keeping the records.</p>
          ) : (
            <form action={deletePosition} className="flex flex-wrap items-center justify-between gap-3">
              <input type="hidden" name="id" value={p.id} />
              <p className="text-muted">Nobody has applied yet, so this position can be deleted permanently.</p>
              <Button variant="danger" size="sm">Delete position</Button>
            </form>
          )}
        </div>
      </HrPanel>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { isHrRole, OTHER_POSITION } from "@hr/shared";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Alert } from "@/components/ui/alert";
import { ButtonLink } from "@/components/ui/button";
import { POSITION_COLUMNS, type PositionRow } from "@/lib/positions";
import { UUID_RE } from "@/lib/format";
import { ApplicationForm } from "./application-form";

export const metadata: Metadata = { title: "Apply" };

export default async function ApplyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, profile } = await requireUser(`/apply/${id}`);
  if (isHrRole(profile.role)) redirect("/hr");
  if (id !== OTHER_POSITION && !UUID_RE.test(id)) notFound();

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const [{ data: positionData }, { data: applied }] = await Promise.all([
    supabase.from("positions").select(POSITION_COLUMNS)
      .eq("is_active", true).eq("status", "open")
      .or(`application_deadline.is.null,application_deadline.gte.${today}`)
      .order("title"),
    supabase.from("applications").select("id, position_id").not("position_id", "is", null),
  ]);
  const positions = (positionData ?? []) as PositionRow[];
  const appliedRows = (applied ?? []) as { id: string; position_id: string }[];

  const header = (title: string, sub?: string) => (
    <div className="mb-8">
      <Link href="/" className="text-sm font-medium text-steel hover:text-ink">Back to open positions</Link>
      <h1 className="mt-3 text-[28px]">{title}</h1>
      {sub && <p className="mt-1 text-muted">{sub}</p>}
    </div>
  );

  if (id !== OTHER_POSITION) {
    const existing = appliedRows.find((a) => a.position_id === id);
    if (existing) {
      return (
        <div className="mx-auto max-w-2xl">
          {header("You've already applied for this position")}
          <ButtonLink href={`/dashboard/applications/${existing.id}`}>View your application</ButtonLink>
        </div>
      );
    }
    if (!positions.some((p) => p.id === id)) {
      return (
        <div className="mx-auto max-w-2xl">
          {header("This position isn't accepting applications")}
          <Alert tone="info">It may have closed or reached its deadline. You can apply for another position or send an open application.</Alert>
          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href="/">See open positions</ButtonLink>
            <ButtonLink href={`/apply/${OTHER_POSITION}`} variant="secondary">Send an open application</ButtonLink>
          </div>
        </div>
      );
    }
  }

  if (!user.email_confirmed_at) {
    return (
      <div className="mx-auto max-w-2xl">
        {header("Confirm your email first")}
        <Alert tone="info">Open the confirmation link we emailed to {profile.email}, then come back to apply.</Alert>
      </div>
    );
  }

  const title = positions.find((p) => p.id === id)?.title;
  return (
    <div className="mx-auto max-w-3xl">
      {header(title ? `Apply for ${title}` : "Send an open application",
        "It takes about five minutes. Have your CV and cover letter ready as PDF or Word files.")}
      <ApplicationForm
        userId={user.id}
        positions={positions}
        appliedPositionIds={appliedRows.map((a) => a.position_id)}
        initialPositionId={id}
        defaults={{
          firstName: profile.first_name, lastName: profile.last_name, email: profile.email,
          phone: profile.phone ?? "", address: profile.address ?? "", city: profile.city ?? "", country: profile.country ?? "",
        }}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { requireHr, displayName } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { HrPanel, PageTitle } from "@/components/hr/panel";
import { can, ROLE_LABEL } from "@/lib/hr/permissions";
import { AddMemberForm, NotificationPrefs, TeamTable, type Member } from "./team";

export const metadata: Metadata = { title: "Team and settings" };

export default async function SettingsPage() {
  const { user, profile } = await requireHr();
  const manage = can(profile.role).manageTeam;
  const supabase = await createClient();
  const [{ data: staff }, { data: me }] = await Promise.all([
    supabase.from("profiles").select("id, email, first_name, last_name, role").neq("role", "candidate").order("first_name"),
    supabase.from("profiles").select("notify_new_registrations, notify_new_applications").eq("id", user.id).single(),
  ]);
  const members: Member[] = (staff ?? []).map((s) => ({ id: s.id, email: s.email, role: s.role, name: displayName(s) }));

  return (
    <div className="grid max-w-4xl gap-6">
      <PageTitle title="Team and settings" />
      <HrPanel title="Your email notifications">
        {profile.role === "hr_viewer"
          ? <p className="p-5 text-sm text-muted">Email notifications go to recruiters and admins. As an {ROLE_LABEL.hr_viewer.toLowerCase().replace("hr", "HR")}, you can follow activity from the dashboard.</p>
          : <NotificationPrefs registrations={me?.notify_new_registrations ?? true} applications={me?.notify_new_applications ?? true} />}
      </HrPanel>
      <HrPanel title={`HR team (${members.length})`}>
        <TeamTable members={members} meId={user.id} canManage={manage} />
        <div className="border-t border-line px-5 py-3 text-xs text-muted">
          Viewers can read everything. Recruiters can also change stages, write notes and schedule interviews. Admins can also manage positions, the team and privacy requests.
        </div>
      </HrPanel>
      {manage && <HrPanel title="Add a team member"><AddMemberForm /></HrPanel>}
    </div>
  );
}

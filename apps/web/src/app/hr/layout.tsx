import { AppHeader } from "@/components/app-header";
import { HrSidebar, HrTabs, type HrNavItem } from "@/components/hr/hr-nav";
import { requireHr } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { can, ROLE_LABEL } from "@/lib/hr/permissions";

// Server-side role gate. Every query below is also enforced by RLS.
export default async function HrLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireHr();
  const perms = can(profile.role);
  const supabase = await createClient();
  const [{ count: newApps }, { count: pendingPrivacy }] = await Promise.all([
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    perms.managePrivacy
      ? supabase.from("deletion_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
      : Promise.resolve({ count: 0 }),
  ]);

  const items: HrNavItem[] = [
    { href: "/hr", label: "Overview", exact: true },
    { href: "/hr/applications", label: "Applications", badge: newApps ?? 0 },
    { href: "/hr/pipeline", label: "Pipeline" },
    { href: "/hr/positions", label: "Positions" },
    { href: "/hr/settings", label: "Team and settings", exact: true },
    ...(perms.managePrivacy ? [{ href: "/hr/settings/privacy", label: "Privacy requests", badge: pendingPrivacy ?? 0 }] : []),
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader profile={profile} wide />
      <div className="mx-auto flex w-full max-w-[1400px] flex-1 gap-8 px-4 sm:px-6">
        <aside className="hidden w-56 shrink-0 py-8 lg:block">
          <div className="sticky top-24 grid gap-6">
            <HrSidebar items={items} />
            <p className="px-3 text-xs text-muted">Signed in as {ROLE_LABEL[profile.role]}</p>
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <HrTabs items={items} />
          <main className="py-6 pb-16 sm:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}

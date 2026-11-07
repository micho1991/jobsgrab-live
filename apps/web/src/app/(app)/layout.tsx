import { isHrRole } from "@hr/shared";
import { AppHeader } from "@/components/app-header";
import { MobileNav } from "@/components/mobile-nav";
import { SiteFooter } from "@/components/site-footer";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireUser();
  let unread = 0;
  if (!isHrRole(profile.role)) {
    const supabase = await createClient();
    const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
    unread = count ?? 0;
  }
  const links = isHrRole(profile.role)
    ? [{ href: "/hr", label: "HR" }, { href: "/", label: "Jobs" }, { href: "/account", label: "Account" }]
    : [{ href: "/dashboard", label: "Dashboard", badge: unread }, { href: "/", label: "Jobs" }, { href: "/account", label: "Account" }];
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader profile={profile} unread={unread} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 pb-24 sm:px-6 sm:py-10 sm:pb-10">{children}</main>
      <SiteFooter />
      <MobileNav links={links} />
    </div>
  );
}

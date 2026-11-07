import Link from "next/link";
import { isHrRole } from "@hr/shared";
import { Logo } from "./logo";
import { NavLinks } from "./nav-links";
import { displayName, type Profile } from "@/lib/auth";

export function AppHeader({ profile, unread = 0, wide = false }: { profile: Profile | null; unread?: number; wide?: boolean }) {
  const hr = profile && isHrRole(profile.role);
  const links = !profile
    ? [{ href: "/", label: "Open positions" }]
    : hr
      ? [{ href: "/hr", label: "HR dashboard" }, { href: "/", label: "Job board" }, { href: "/account", label: "Account" }]
      : [{ href: "/dashboard", label: "Dashboard", badge: unread }, { href: "/", label: "Open positions" }, { href: "/account", label: "Account" }];

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
      <div className={`mx-auto flex h-16 items-center gap-6 px-4 sm:px-6 ${wide ? "max-w-[1400px]" : "max-w-6xl"}`}>
        <Logo href={profile ? (hr ? "/hr" : "/dashboard") : "/"} />
        <NavLinks links={links} />
        <div className="ml-auto flex items-center gap-3">
          {profile ? (
            <>
              <span className="hidden text-sm text-muted md:inline">{displayName(profile)}</span>
              <form action="/auth/signout" method="post">
                <button className="h-9 rounded-[var(--radius-control)] px-3 text-sm font-medium text-ink hover:bg-ink/5">Sign out</button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="h-9 rounded-[var(--radius-control)] px-3 text-sm font-medium leading-9 text-ink hover:bg-ink/5">Sign in</Link>
              <Link href="/register" className="h-9 rounded-[var(--radius-control)] bg-ink px-3.5 text-sm font-medium leading-9 text-white hover:bg-ink-hover">Create account</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

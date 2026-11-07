"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  if (links.length <= 1) return null;
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
      {links.map((l) => {
        const active = l.href === "/" ? path === "/" : path === l.href || path.startsWith(l.href + "/");
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
            className={`relative rounded-md px-3 py-2 text-sm font-medium transition-colors ${active ? "text-ink" : "text-muted hover:text-ink"}`}>
            {l.label}
            {!!l.badge && <span className="ml-1.5 rounded-full bg-ink px-1.5 py-px text-[11px] font-semibold text-white" aria-label={`${l.badge} unread updates`}>{l.badge}</span>}
            {active && <span className="absolute inset-x-3 -bottom-[13px] h-0.5 rounded-full bg-ink" />}
          </Link>
        );
      })}
    </nav>
  );
}

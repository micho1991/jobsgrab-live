"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

/** Bottom tab bar for signed-in users on small screens. */
export function MobileNav({ links }: { links: { href: string; label: string; badge?: number }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] sm:hidden">
      <ul className="grid" style={{ gridTemplateColumns: `repeat(${links.length}, minmax(0, 1fr))` }}>
        {links.map((l) => {
          const active = l.href === "/" ? path === "/" : path === l.href || path.startsWith(l.href + "/");
          return (
            <li key={l.href}>
              <Link href={l.href} aria-current={active ? "page" : undefined}
                className={`flex h-14 items-center justify-center text-[13px] font-medium ${active ? "text-ink" : "text-muted"}`}>
                <span className={active ? "border-b-2 border-ink pb-0.5" : ""}>{l.label}</span>
                {!!l.badge && <span className="ml-1 rounded-full bg-ink px-1.5 text-[11px] font-semibold text-white" aria-label={`${l.badge} unread updates`}>{l.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

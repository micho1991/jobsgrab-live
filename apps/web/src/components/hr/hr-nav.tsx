"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

export interface HrNavItem { href: string; label: string; badge?: number; exact?: boolean }

const isActive = (path: string, item: HrNavItem) =>
  item.exact ? path === item.href : path === item.href || path.startsWith(item.href + "/");

/** Sidebar on large screens. */
export function HrSidebar({ items }: { items: HrNavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="HR" className="grid gap-0.5">
      {items.map((it) => {
        const active = isActive(path, it);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined}
            className={cn("flex items-center justify-between rounded-[var(--radius-control)] px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-ink text-white" : "text-body hover:bg-white hover:text-ink")}>
            {it.label}
            {!!it.badge && (
              <span className={cn("rounded-full px-1.5 text-xs font-semibold tabular-nums", active ? "bg-white/20 text-white" : "bg-ink/10 text-ink")}
                aria-label={`${it.badge} new`}>{it.badge}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

/** Horizontal, scrollable tabs below large screens. */
export function HrTabs({ items }: { items: HrNavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="HR" className="-mx-4 overflow-x-auto border-b border-line bg-white px-4 sm:-mx-6 sm:px-6 lg:hidden">
      <ul className="flex gap-1">
        {items.map((it) => {
          const active = isActive(path, it);
          return (
            <li key={it.href}>
              <Link href={it.href} aria-current={active ? "page" : undefined}
                className={cn("flex h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-2.5 text-sm font-medium",
                  active ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink")}>
                {it.label}
                {!!it.badge && <span className="rounded-full bg-ink/10 px-1.5 text-xs font-semibold text-ink">{it.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

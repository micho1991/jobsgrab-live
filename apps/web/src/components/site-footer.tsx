import Link from "next/link";
import { env } from "@/lib/env";

export function SiteFooter() {
  return (
    <footer className="border-t border-line pb-20 sm:pb-0">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-6 text-sm text-muted sm:px-6">
        <span>© {new Date().getFullYear()} {env.companyName}</span>
        <Link href="/privacy" className="hover:text-ink">Privacy policy</Link>
        <a href={`mailto:${env.privacyContact}`} className="hover:text-ink">Contact</a>
      </div>
    </footer>
  );
}

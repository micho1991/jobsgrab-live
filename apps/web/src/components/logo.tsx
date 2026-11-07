import Link from "next/link";
import { env } from "@/lib/env";

export function Logo({ tone = "dark", href = "/" }: { tone?: "dark" | "light"; href?: string }) {
  const light = tone === "light";
  return (
    <Link href={href} className="inline-flex items-center gap-2.5 rounded-md" aria-label={`${env.companyName} Careers home`}>
      <span className={`grid size-8 place-items-center rounded-[9px] text-[15px] font-semibold ${light ? "bg-white text-deep" : "bg-ink text-white"}`}>
        {env.companyName.charAt(0).toUpperCase()}
      </span>
      <span className={`text-[17px] font-semibold tracking-[-0.01em] ${light ? "text-white" : "text-ink"}`}>
        {env.companyName} <span className={light ? "text-steel-light font-medium" : "text-steel font-medium"}>Careers</span>
      </span>
    </Link>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const tones = {
  error: "bg-bad-bg text-bad border-bad/20",
  success: "bg-ok-bg text-ok border-ok/20",
  info: "bg-info-bg text-ink border-ink/10",
};

export function Alert({ tone = "info", children, className }: { tone?: keyof typeof tones; children: ReactNode; className?: string }) {
  return (
    <div role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-[var(--radius-control)] border px-3.5 py-2.5 text-sm leading-relaxed", tones[tone], className)}>
      {children}
    </div>
  );
}

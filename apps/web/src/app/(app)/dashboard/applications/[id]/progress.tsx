import { PROGRESS_STEPS, STATUS_META, type ApplicationStatus } from "@hr/shared";
import type { HistoryRow } from "@/lib/applications";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Candidate-facing progress tracker across the seven hiring stages. */
export function ApplicationProgress({ status, history }: { status: ApplicationStatus; history: HistoryRow[] }) {
  const rejected = status === "rejected";
  // For a rejected application, show how far it got before the decision.
  const reached: ApplicationStatus = rejected
    ? ([...history].reverse().find((h) => h.to_status !== "rejected")?.to_status ?? "submitted")
    : status;
  const current = STATUS_META[reached].step ?? 1;
  const firstReached = (s: ApplicationStatus) => history.find((h) => h.to_status === s)?.created_at;

  return (
    <ol className="grid gap-0 sm:grid-cols-7" aria-label="Application progress">
      {PROGRESS_STEPS.map((s, i) => {
        const n = i + 1;
        const done = n < current || (n === current && s === "hired");
        const isCurrent = n === current && !rejected && s !== "hired";
        const date = n <= current ? firstReached(s) : undefined;
        return (
          <li key={s} className="relative flex gap-3 pb-5 sm:flex-col sm:items-center sm:gap-2 sm:pb-0 sm:text-center"
            aria-current={isCurrent ? "step" : undefined}>
            {/* connector */}
            {i < PROGRESS_STEPS.length - 1 && (
              <span aria-hidden="true" className={cn(
                "absolute left-[13px] top-7 h-[calc(100%-28px)] w-px sm:left-[calc(50%+14px)] sm:top-[13px] sm:h-px sm:w-[calc(100%-28px)]",
                n < current ? "bg-ink" : "bg-line")} />
            )}
            <span className={cn(
              "relative z-10 grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums",
              done ? "border-ink bg-ink text-white"
                : isCurrent ? "border-ink bg-white text-ink ring-4 ring-ink/10"
                : n === current && rejected ? "border-steel bg-white text-steel"
                : "border-line bg-white text-muted")}>
              {done ? (
                <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
              ) : n}
            </span>
            <span className="min-w-0">
              <span className={cn("block text-sm leading-snug", n <= current ? "font-medium text-ink" : "text-muted")}>
                {STATUS_META[s].label}
                {isCurrent && <span className="sr-only"> (current stage)</span>}
              </span>
              {date && <span className="block text-xs text-muted">{fmtDate(date)}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

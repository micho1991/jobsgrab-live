"use client";
import { cn } from "@/lib/cn";

export function StepIndicator({ steps, current, maxReached, onSelect }: {
  steps: string[]; current: number; maxReached: number; onSelect: (i: number) => void;
}) {
  return (
    <nav aria-label="Application steps">
      {/* Small screens: compact label + bar */}
      <div className="sm:hidden">
        <p className="text-sm text-muted">Step {current + 1} of {steps.length}</p>
        <p className="font-medium text-ink">{steps[current]}</p>
        <div className="mt-3 h-1 rounded-full bg-line">
          <div className="h-1 rounded-full bg-ink transition-[width]" style={{ width: `${((current + 1) / steps.length) * 100}%` }} />
        </div>
      </div>
      {/* Larger screens: full sequence */}
      <ol className="hidden items-center gap-2 sm:flex">
        {steps.map((label, i) => {
          const done = i < current;
          const reachable = i <= maxReached && i !== current;
          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-2">
              <button type="button" disabled={!reachable} onClick={() => onSelect(i)}
                aria-current={i === current ? "step" : undefined}
                className={cn("flex min-w-0 items-center gap-2 rounded-md text-left text-sm", reachable && "hover:text-ink")}>
                <span className={cn(
                  "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums",
                  i === current ? "border-ink bg-ink text-white" : done ? "border-ink text-ink" : "border-line text-muted",
                )}>
                  {done ? (
                    <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  ) : i + 1}
                </span>
                <span className={cn("truncate", i === current ? "font-medium text-ink" : "text-muted")}>{label}</span>
                {done && <span className="sr-only">(completed)</span>}
              </button>
              {i < steps.length - 1 && <span aria-hidden="true" className={cn("h-px min-w-4 flex-1", done ? "bg-ink" : "bg-line")} />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

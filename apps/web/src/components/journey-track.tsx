import { PROGRESS_STEPS, STATUS_META } from "@hr/shared";

/**
 * The hiring journey from "Submitted" to "Hired", shown on the auth panel.
 * It previews the progress indicator candidates see on their dashboard.
 * The track fills once on load (respecting reduced-motion).
 */
export function JourneyTrack({ reached = 4 }: { reached?: number }) {
  const stepDelay = 1.6 / reached;
  return (
    <ol className="relative grid gap-[22px]" aria-label="Application stages">
      <span aria-hidden="true" className="absolute left-[13px] top-3 bottom-3 w-px bg-white/15" />
      <span aria-hidden="true" className="track-fill absolute left-[13px] top-3 w-px bg-white"
        style={{ height: `calc(${((reached - 1) / (PROGRESS_STEPS.length - 1)) * 100}% - 12px)` }} />
      {PROGRESS_STEPS.map((status, i) => {
        const n = i + 1;
        const on = n <= reached;
        return (
          <li key={status} className="relative flex items-center gap-4">
            <span
              className={`grid size-[27px] shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums
                ${on ? "step-on border-white" : "border-white/25 text-steel-light"}`}
              style={on ? { animationDelay: `${0.3 + (n - 1) * stepDelay}s` } : undefined}>
              {n}
            </span>
            <span className={on ? "text-white" : "text-steel-light"}>{STATUS_META[status].label}</span>
          </li>
        );
      })}
    </ol>
  );
}

import { fmtDate } from "@/lib/format";

/** Daily application volume as an SVG bar chart, with a table for screen readers. */
export function DailyChart({ data }: { data: { date: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const W = 600, H = 140, gap = 3, bw = (W - gap * (data.length - 1)) / data.length;
  const total = data.reduce((s, d) => s + d.count, 0);
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img"
        aria-label={`${total} applications over the last 30 days`}>
        <line x1="0" x2={W} y1={H} y2={H} stroke="var(--color-line)" />
        {data.map((d, i) => {
          const h = (d.count / max) * (H - 8);
          return (
            <g key={d.date}>
              <rect x={i * (bw + gap)} y={H - h} width={bw} height={Math.max(h, d.count ? 2 : 0)} rx="2" fill="var(--color-ink)">
                <title>{`${fmtDate(d.date)}: ${d.count}`}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      {/* Axis labels as HTML so they stay readable when the chart scales down */}
      <figcaption className="mt-1.5 flex justify-between text-xs text-muted" aria-hidden="true">
        <span>{data[0] && fmtDate(data[0].date)}</span><span>Today</span>
      </figcaption>
      <table className="sr-only">
        <caption>Applications per day</caption>
        <tbody>{data.map((d) => <tr key={d.date}><th>{d.date}</th><td>{d.count}</td></tr>)}</tbody>
      </table>
    </figure>
  );
}

/** Horizontal bars, e.g. applications per position. */
export function BarList({ items }: { items: { label: string; value: number; href?: string }[] }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <ul className="grid gap-2.5">
      {items.map((it) => (
        <li key={it.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-sm">
          {it.href ? <a href={it.href} className="truncate text-ink hover:underline">{it.label}</a> : <span className="truncate text-ink">{it.label}</span>}
          <span className="font-semibold tabular-nums text-ink">{it.value}</span>
          <span className="col-span-2 h-1.5 rounded-full bg-mist">
            <span className="block h-1.5 rounded-full bg-steel" style={{ width: `${(it.value / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

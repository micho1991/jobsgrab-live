"use client";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useTransition } from "react";
import { APPLICATION_STATUSES, STATUS_META } from "@hr/shared";
import { inputClass } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";

const selectClass = `${inputClass()} h-9 w-auto min-w-0 pr-8 text-sm`;

export function FilterBar({ positions }: { positions: { id: string; title: string }[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const search = useRef<HTMLInputElement>(null);
  // Changes made in quick succession must build on each other, not on a URL
  // that hasn't finished updating yet.
  const latest = useRef(params.toString());
  useEffect(() => { latest.current = params.toString(); }, [params]);

  function update(changes: Record<string, string>) {
    const next = new URLSearchParams(latest.current);
    for (const [k, v] of Object.entries(changes)) v ? next.set(k, v) : next.delete(k);
    next.delete("page"); // any filter change returns to page 1
    latest.current = next.toString();
    start(() => router.replace(`${path}?${next.toString()}`, { scroll: false }));
  }

  const active = ["q", "position", "status", "from", "to"].some((k) => params.get(k));

  return (
    <form role="search" className="flex flex-wrap items-end gap-3"
      onSubmit={(e) => { e.preventDefault(); update({ q: search.current?.value.trim() ?? "" }); }}>
      <div className="min-w-[220px] flex-1">
        <label htmlFor="q" className="mb-1 block text-xs font-medium text-muted">Search</label>
        <input ref={search} id="q" type="search" defaultValue={params.get("q") ?? ""} placeholder="First name, last name or email"
          className={`${inputClass()} h-9 text-sm`} onBlur={(e) => e.target.value.trim() !== (params.get("q") ?? "") && update({ q: e.target.value.trim() })} />
      </div>
      <div>
        <label htmlFor="f-position" className="mb-1 block text-xs font-medium text-muted">Position</label>
        <select id="f-position" className={selectClass} value={params.get("position") ?? ""} onChange={(e) => update({ position: e.target.value })}>
          <option value="">All positions</option>
          {positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
          <option value="other">Other (not listed)</option>
        </select>
      </div>
      <div>
        <label htmlFor="f-status" className="mb-1 block text-xs font-medium text-muted">Status</label>
        <select id="f-status" className={selectClass} value={params.get("status") ?? ""} onChange={(e) => update({ status: e.target.value })}>
          <option value="">All statuses</option>
          {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
        </select>
      </div>
      <div>
        <label htmlFor="f-from" className="mb-1 block text-xs font-medium text-muted">Submitted from</label>
        <input id="f-from" type="date" className={`${inputClass()} h-9 text-sm`} value={params.get("from") ?? ""} onChange={(e) => update({ from: e.target.value })} />
      </div>
      <div>
        <label htmlFor="f-to" className="mb-1 block text-xs font-medium text-muted">to</label>
        <input id="f-to" type="date" className={`${inputClass()} h-9 text-sm`} value={params.get("to") ?? ""} onChange={(e) => update({ to: e.target.value })} />
      </div>
      <div className="flex h-9 items-center gap-3">
        <button type="submit" className="sr-only">Search</button>
        {active && (
          <button type="button" onClick={() => { if (search.current) search.current.value = ""; latest.current = ""; start(() => router.replace(path)); }}
            className="text-sm font-medium text-steel hover:text-ink">Clear filters</button>
        )}
        {pending && <Spinner className="size-4 text-steel" />}
      </div>
    </form>
  );
}

import { STATUS_META, type ApplicationStatus } from "@hr/shared";

const TONE: Record<string, string> = {
  slate: "bg-slate-100 text-slate-700", blue: "bg-blue-100 text-blue-900", indigo: "bg-indigo-100 text-indigo-900",
  violet: "bg-violet-100 text-violet-900", amber: "bg-amber-100 text-amber-900", teal: "bg-teal-100 text-teal-900",
  green: "bg-ok-bg text-ok", red: "bg-bad-bg text-bad",
};

export function StatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-[13px] font-medium ${TONE[meta.tone]}`}>
      {meta.label}
    </span>
  );
}

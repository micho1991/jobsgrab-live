// Device-local formatting (the phone's own timezone and locale settings).
const day = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric" });
const dayTime = new Intl.DateTimeFormat(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const longDayTime = new Intl.DateTimeFormat(undefined, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZoneName: "short" });
export const fmtDate = (iso: string) => day.format(new Date(iso.length === 10 ? `${iso}T00:00:00` : iso));
export const fmtDateTime = (iso: string) => dayTime.format(new Date(iso));
export const fmtLongDateTime = (iso: string) => longDayTime.format(new Date(iso));
export const positionTitle = (a: { positions: { title: string } | null; other_position: string | null }) =>
  a.positions?.title ?? a.other_position ?? "Open application";

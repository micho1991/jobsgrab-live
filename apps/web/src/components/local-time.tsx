"use client";
import { useEffect, useState } from "react";

const OPTIONS = {
  datetime: { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" },
  long: { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", timeZoneName: "short" },
} as const;

/**
 * Shows a timestamp in the viewer's own timezone. The server doesn't know the
 * visitor's timezone, so it renders UTC (labelled) and the browser swaps in local time.
 */
export function LocalTime({ iso, format = "datetime" }: { iso: string; format?: keyof typeof OPTIONS }) {
  const [text, setText] = useState(() =>
    new Intl.DateTimeFormat("en-GB", { ...OPTIONS[format], timeZone: "UTC", ...(format === "datetime" ? { timeZoneName: "short" } : {}) }).format(new Date(iso)));
  useEffect(() => { setText(new Intl.DateTimeFormat("en-GB", OPTIONS[format]).format(new Date(iso))); }, [iso, format]);
  return <time dateTime={iso}>{text}</time>;
}

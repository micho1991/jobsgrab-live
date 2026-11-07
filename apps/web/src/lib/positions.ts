import { EMPLOYMENT_TYPES, type EmploymentType } from "@hr/shared";

export interface PositionRow {
  id: string;
  title: string;
  department: string | null;
  location: string | null;
  employment_type: EmploymentType;
  description: string;
  application_deadline: string | null;
}

export const POSITION_COLUMNS = "id, title, department, location, employment_type, description, application_deadline";

const deadlineFmt = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

export function deadlineLabel(d: string | null): string | null {
  if (!d) return null;
  const date = new Date(`${d}T00:00:00Z`);
  const today = new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");
  const days = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (days === 0) return "Closes today";
  if (days === 1) return "Closes tomorrow";
  if (days <= 7) return `Closes in ${days} days`;
  return `Apply by ${deadlineFmt.format(date)}`;
}

export const employmentLabel = (t: EmploymentType) => EMPLOYMENT_TYPES[t] ?? t;

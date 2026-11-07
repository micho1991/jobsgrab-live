import type { ApplicationStatus, AppRole, DocumentKind } from "@hr/shared";

export interface HrApplicationRow {
  id: string; reference: string; status: ApplicationStatus; submitted_at: string; status_changed_at: string;
  first_name: string; last_name: string; email: string; city: string; country: string;
  candidate_id: string; position_id: string | null; other_position: string | null;
  positions: { title: string } | null;
}
export const HR_ROW_COLUMNS =
  "id, reference, status, submitted_at, status_changed_at, first_name, last_name, email, city, country, candidate_id, position_id, other_position, positions(title)";

export interface HrDocument {
  id: string; kind: DocumentKind; file_name: string; size_bytes: number; created_at: string; replaced_at: string | null;
}
export interface HrNote {
  id: string; body: string; created_at: string; updated_at: string; author_id: string | null;
  author: { first_name: string; last_name: string } | null;
}
export interface HrHistory {
  id: number; from_status: ApplicationStatus | null; to_status: ApplicationStatus; created_at: string;
  changed_by: string | null; actor: { first_name: string; last_name: string; role: AppRole } | null;
}

export interface OverviewStats {
  total_candidates: number; total_applications: number; new_applications: number; new_last_7_days: number;
  by_status: Partial<Record<ApplicationStatus, number>>;
  by_position: { id: string | null; title: string; n: number }[];
  daily_last_30_days: { date: string; count: number }[];
  upcoming_interviews: number; pending_deletion_requests: number;
}

export const candidateName = (a: { first_name: string; last_name: string }) => `${a.first_name} ${a.last_name}`.trim();
export const appPosition = (a: { positions: { title: string } | null; other_position: string | null }) =>
  a.positions?.title ?? (a.other_position ? `Other: ${a.other_position}` : "Open application");

import type { ApplicationStatus, DocumentKind } from "@hr/shared";

export interface ApplicationSummary {
  id: string;
  reference: string;
  status: ApplicationStatus;
  submitted_at: string;
  status_changed_at: string;
  other_position: string | null;
  positions: { title: string } | null;
}
export const SUMMARY_COLUMNS = "id, reference, status, submitted_at, status_changed_at, other_position, positions(title)";

export interface ApplicationDetail extends ApplicationSummary {
  first_name: string; last_name: string; email: string; phone: string;
  address: string; city: string; country: string;
  additional_info: string | null;
  consented_at: string; privacy_policy_version: string;
  positions: { title: string; department: string | null; location: string | null } | null;
}
export const DETAIL_COLUMNS =
  "id, reference, status, submitted_at, status_changed_at, other_position, first_name, last_name, email, phone, address, city, country, additional_info, consented_at, privacy_policy_version, positions(title, department, location)";

export interface DocumentRow {
  id: string; kind: DocumentKind; file_name: string; size_bytes: number; mime_type: string; created_at: string;
}
export const DOCUMENT_COLUMNS = "id, kind, file_name, size_bytes, mime_type, created_at";

export interface HistoryRow { to_status: ApplicationStatus; created_at: string }

export interface InterviewRow {
  id: string; scheduled_at: string; duration_minutes: number; mode: "in_person" | "video" | "phone";
  location: string | null; meeting_url: string | null; details_for_candidate: string | null; cancelled_at: string | null;
}
export const INTERVIEW_COLUMNS = "id, scheduled_at, duration_minutes, mode, location, meeting_url, details_for_candidate, cancelled_at";

export interface NotificationRow {
  id: string; type: string; title: string; body: string; application_id: string | null; read_at: string | null; created_at: string;
}

export const positionTitle = (a: Pick<ApplicationSummary, "positions" | "other_position">) =>
  a.positions?.title ?? a.other_position ?? "Open application";

/** A file uploaded to storage but not yet attached to an application. */
export interface UploadedFile { path: string; name: string; size: number; mimeType: string }

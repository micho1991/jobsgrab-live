// Single source of truth for the recruitment pipeline (mirrors public.application_status).
export const APPLICATION_STATUSES = [
  "submitted", "under_review", "shortlisted", "interview_scheduled",
  "assessment", "offer_sent", "hired", "rejected",
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export interface StatusMeta {
  label: string;
  /** Short explanation shown to candidates */
  candidateHint: string;
  /** Tailwind-friendly tone used by badges and Kanban columns */
  tone: "slate" | "blue" | "indigo" | "violet" | "amber" | "teal" | "green" | "red";
  /** Position in the candidate-facing progress indicator (rejected is terminal, not a step) */
  step: number | null;
}

export const STATUS_META: Record<ApplicationStatus, StatusMeta> = {
  submitted:           { label: "Submitted",           tone: "slate",  step: 1, candidateHint: "We’ve received your application." },
  under_review:        { label: "Under Review",        tone: "blue",   step: 2, candidateHint: "Our team is reviewing your application." },
  shortlisted:         { label: "Shortlisted",         tone: "indigo", step: 3, candidateHint: "You’ve been shortlisted for the next stage." },
  interview_scheduled: { label: "Interview Scheduled", tone: "violet", step: 4, candidateHint: "An interview has been scheduled. Check your email for details." },
  assessment:          { label: "Assessment",          tone: "amber",  step: 5, candidateHint: "You’re in the assessment stage." },
  offer_sent:          { label: "Offer Sent",          tone: "teal",   step: 6, candidateHint: "We’ve sent you an offer." },
  hired:               { label: "Hired",               tone: "green",  step: 7, candidateHint: "Congratulations and welcome aboard!" },
  rejected:            { label: "Rejected",            tone: "red",    step: null, candidateHint: "Thank you for your interest. We won’t be moving forward this time." },
};

export const PROGRESS_STEPS = APPLICATION_STATUSES.filter((s) => STATUS_META[s].step !== null);
export const isTerminalStatus = (s: ApplicationStatus) => s === "hired" || s === "rejected";

export const ROLES = ["candidate", "hr_viewer", "hr_recruiter", "hr_admin"] as const;
export type AppRole = (typeof ROLES)[number];
export const isHrRole = (r: AppRole | null | undefined) => r === "hr_viewer" || r === "hr_recruiter" || r === "hr_admin";
export const canManageApplications = (r: AppRole | null | undefined) => r === "hr_recruiter" || r === "hr_admin";

export const EMPLOYMENT_TYPES = {
  full_time: "Full-time", part_time: "Part-time", contract: "Contract",
  internship: "Internship", temporary: "Temporary",
} as const;
export type EmploymentType = keyof typeof EMPLOYMENT_TYPES;

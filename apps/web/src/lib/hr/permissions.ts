import { canManageApplications, type AppRole } from "@hr/shared";

export const can = (role: AppRole) => ({
  manageApplications: canManageApplications(role), // status, notes, interviews
  managePositions: role === "hr_admin",
  manageTeam: role === "hr_admin",
  managePrivacy: role === "hr_admin",
});

export const ROLE_LABEL: Record<AppRole, string> = {
  candidate: "Candidate", hr_viewer: "HR viewer", hr_recruiter: "Recruiter", hr_admin: "HR admin",
};

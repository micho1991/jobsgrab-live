// Zod schemas shared by web + mobile forms. The database enforces the same
// limits independently, so client validation is for UX, not for security.
import { z } from "zod";
import { APPLICATION_STATUSES, EMPLOYMENT_TYPES, ROLES } from "./statuses";

const name = (label: string) =>
  z.string().trim().min(1, `${label} is required`).max(100, `${label} is too long`);

export const passwordSchema = z.string()
  .min(8, "At least 8 characters")
  .max(72, "At most 72 characters")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[0-9]/, "Include a number");

export const emailSchema = z.string().trim().toLowerCase()
  .min(1, "Email is required").max(254).email("Enter a valid email address");

export const registerSchema = z.object({
  firstName: name("First name"),
  lastName: name("Last name"),
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((v) => v.password === v.confirmPassword, {
  path: ["confirmPassword"], message: "Passwords do not match",
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Password is required"),
});

export const forgotPasswordSchema = z.object({ email: emailSchema });

export const resetPasswordSchema = z.object({
  password: passwordSchema,
  confirmPassword: z.string(),
}).refine((v) => v.password === v.confirmPassword, {
  path: ["confirmPassword"], message: "Passwords do not match",
});

const phone = z.string().trim().min(5, "Enter a valid phone number").max(30)
  .regex(/^[+()\d\s.-]+$/, "Use digits, spaces and + ( ) - only");

export const profileSchema = z.object({
  firstName: name("First name"),
  lastName: name("Last name"),
  phone: phone.optional().or(z.literal("")),
  address: z.string().trim().max(255).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
});

export const OTHER_POSITION = "other" as const;

export const applicationSchema = z.object({
  positionId: z.string().min(1, "Select a position"),            // uuid or "other"
  otherPosition: z.string().trim().max(150).optional(),
  firstName: name("First name"),
  lastName: name("Last name"),
  address: z.string().trim().min(3, "Address is required").max(255),
  city: z.string().trim().min(1, "City is required").max(100),
  country: z.string().trim().min(2, "Country is required").max(100),
  phone,
  email: emailSchema,
  additionalInfo: z.string().trim().max(5000, "Please keep this under 5,000 characters").optional(),
  consentAccuracy: z.literal(true, { errorMap: () => ({ message: "Please confirm your information is accurate" }) }),
  consentPrivacy: z.literal(true, { errorMap: () => ({ message: "Please accept the Privacy Policy" }) }),
}).superRefine((v, ctx) => {
  if (v.positionId === OTHER_POSITION && (!v.otherPosition || v.otherPosition.length < 2)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["otherPosition"], message: "Tell us which position you're interested in" });
  }
});

export const positionSchema = z.object({
  title: z.string().trim().min(2, "Title is required").max(150),
  department: z.string().trim().max(100).optional(),
  location: z.string().trim().max(150).optional(),
  employmentType: z.enum(Object.keys(EMPLOYMENT_TYPES) as [keyof typeof EMPLOYMENT_TYPES, ...(keyof typeof EMPLOYMENT_TYPES)[]]),
  description: z.string().max(20000).default(""),
  applicationDeadline: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  status: z.enum(["open", "closed"]),
  isActive: z.boolean(),
});

export const statusChangeSchema = z.object({
  applicationId: z.string().uuid(),
  status: z.enum(APPLICATION_STATUSES),
});

export const noteSchema = z.object({
  body: z.string().trim().min(1, "Note cannot be empty").max(5000),
});

export const interviewSchema = z.object({
  scheduledAt: z.string().datetime({ offset: true, message: "Choose a date and time" }),
  durationMinutes: z.number().int().min(10).max(480).default(60),
  mode: z.enum(["in_person", "video", "phone"]),
  location: z.string().trim().max(255).optional(),
  meetingUrl: z.string().trim().url().startsWith("https://", "Use an https:// link").max(500).optional().or(z.literal("")),
  detailsForCandidate: z.string().trim().max(2000).optional(),
});

export const roleChangeSchema = z.object({ userId: z.string().uuid(), role: z.enum(ROLES) });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type ApplicationInput = z.infer<typeof applicationSchema>;
export type PositionInput = z.infer<typeof positionSchema>;
export type InterviewInput = z.infer<typeof interviewSchema>;

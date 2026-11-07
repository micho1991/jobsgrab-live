// Transactional email templates. Every value from the payload is HTML-escaped.
// Brand values are read from env so the company name/colours are configurable.

const COMPANY = Deno.env.get("COMPANY_NAME") ?? "Your Company";
const APP_URL = (Deno.env.get("APP_URL") ?? "http://localhost:3000").replace(/\/$/, "");
const TIMEZONE = Deno.env.get("APP_TIMEZONE") ?? "UTC";
const NAVY = "#0B1F3A";

type Payload = Record<string, unknown>;
export interface RenderedEmail { subject: string; html: string; text: string }

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const fmtDate = (iso: unknown) => {
  if (typeof iso !== "string") return "";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "full", timeStyle: "short", timeZone: TIMEZONE,
  }).format(new Date(iso)) + ` (${TIMEZONE})`;
};

const MODE_LABEL: Record<string, string> = { in_person: "In person", video: "Video call", phone: "Phone call" };

function layout(heading: string, bodyHtml: string, cta?: { label: string; url: string }) {
  const button = cta
    ? `<p style="margin:28px 0 8px"><a href="${esc(cta.url)}" style="background:${NAVY};color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600;display:inline-block">${esc(cta.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;background:#F4F6F9;font-family:Inter,Segoe UI,Helvetica,Arial,sans-serif;color:#1F2937">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #E5E7EB">
<tr><td style="background:${NAVY};padding:20px 28px;color:#fff;font-size:16px;font-weight:700;letter-spacing:.2px">${esc(COMPANY)} Careers</td></tr>
<tr><td style="padding:28px">
<h1 style="font-size:20px;line-height:1.3;margin:0 0 16px;color:${NAVY}">${esc(heading)}</h1>
<div style="font-size:15px;line-height:1.6">${bodyHtml}</div>${button}
</td></tr>
<tr><td style="padding:16px 28px;border-top:1px solid #E5E7EB;font-size:12px;color:#6B7280">
You are receiving this email because of your account on the ${esc(COMPANY)} careers portal.
</td></tr></table></td></tr></table></body></html>`;
}

const toText = (html: string) =>
  html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<[^>]+>/g, "")
      .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
      .replace(/\n{3,}/g, "\n\n").trim();

function build(subject: string, heading: string, body: string, cta?: { label: string; url: string }): RenderedEmail {
  const html = layout(heading, body, cta);
  return { subject, html, text: toText(body) + (cta ? `\n\n${cta.label}: ${cta.url}` : "") };
}

function interviewBlock(p: Payload) {
  const rows = [
    ["When", fmtDate(p.scheduled_at)],
    ["Duration", p.duration_minutes ? `${p.duration_minutes} minutes` : ""],
    ["Format", MODE_LABEL[String(p.mode)] ?? ""],
    ["Location", p.location ?? ""],
    ["Meeting link", p.meeting_url ?? ""],
  ].filter(([, v]) => v);
  const table = rows.map(([k, v]) =>
    `<tr><td style="padding:6px 12px 6px 0;color:#6B7280;white-space:nowrap">${esc(k)}</td><td style="padding:6px 0;font-weight:500">${esc(v)}</td></tr>`).join("");
  const details = p.details ? `<p>${esc(p.details)}</p>` : "";
  return `<table role="presentation" style="margin:12px 0;border-collapse:collapse">${table}</table>${details}`;
}

export function renderEmail(template: string, p: Payload): RenderedEmail {
  const hi = `<p>Hi ${esc(p.first_name || "there")},</p>`;
  const appUrl = p.application_id ? `${APP_URL}/dashboard/applications/${esc(p.application_id)}` : `${APP_URL}/dashboard`;
  const hrUrl = p.application_id ? `${APP_URL}/hr/applications/${esc(p.application_id)}` : `${APP_URL}/hr`;

  switch (template) {
    case "account_created":
      return build(`Welcome to ${COMPANY} Careers`, "Your account is ready",
        `${hi}<p>Thanks for creating an account. You can now browse open positions, submit applications and follow their progress from your dashboard.</p>`,
        { label: "Go to your dashboard", url: `${APP_URL}/dashboard` });

    case "application_submitted":
      return build(`Application received: ${p.position}`, "We've received your application",
        `${hi}<p>Thank you for applying for <strong>${esc(p.position)}</strong>. Your reference number is <strong>${esc(p.reference)}</strong>.</p>
         <p>Our team will review your application and you'll receive an email whenever its status changes.</p>`,
        { label: "View your application", url: appUrl });

    case "application_status_changed":
      return build(`Update on your application: ${p.status_label}`, "Your application status has changed",
        `${hi}<p>The status of your application for <strong>${esc(p.position)}</strong> (${esc(p.reference)}) is now:</p>
         <p style="font-size:17px;font-weight:700;color:${NAVY}">${esc(p.status_label)}</p>`,
        { label: "View details", url: appUrl });

    case "interview_scheduled":
      return build(`Interview scheduled: ${p.position}`, "You're invited to an interview",
        `${hi}<p>We'd like to invite you to an interview for <strong>${esc(p.position)}</strong> (${esc(p.reference)}).</p>${interviewBlock(p)}
         <p>If this time doesn't work for you, please reply to this email.</p>`,
        { label: "View in your dashboard", url: appUrl });

    case "interview_updated":
      return build(`Interview updated: ${p.position}`, "Your interview details have changed",
        `${hi}<p>The details of your interview for <strong>${esc(p.position)}</strong> have been updated:</p>${interviewBlock(p)}`,
        { label: "View in your dashboard", url: appUrl });

    case "interview_cancelled":
      return build(`Interview cancelled: ${p.position}`, "Your interview has been cancelled",
        `${hi}<p>Your interview for <strong>${esc(p.position)}</strong> scheduled for ${esc(fmtDate(p.scheduled_at))} has been cancelled. We'll be in touch about next steps.</p>`,
        { label: "View your application", url: appUrl });

    case "deletion_request_received":
      return build("We've received your data deletion request", "Deletion request received",
        `${hi}<p>We've received your request to delete your personal data. We'll process it within 30 days and confirm by email once it's complete.</p>`);

    case "account_deleted":
      return build("Your data has been deleted", "Your account has been deleted",
        `${hi}<p>As requested, your account, applications and uploaded documents have been permanently deleted from our recruitment system.</p>`);

    case "deletion_request_rejected":
      return build("About your data deletion request", "Update on your deletion request",
        `${hi}<p>We were unable to complete your deletion request at this time.</p>${p.note ? `<p>${esc(p.note)}</p>` : ""}<p>Please reply to this email if you have any questions.</p>`);

    case "hr_new_registration":
      return build(`New candidate registered: ${p.candidate_name || p.candidate_email}`, "New candidate registration",
        `<p><strong>${esc(p.candidate_name || "A new candidate")}</strong> (${esc(p.candidate_email)}) has created an account.</p>`,
        { label: "Open HR dashboard", url: `${APP_URL}/hr` });

    case "hr_new_application":
      return build(`New application: ${p.position}`, "New application submitted",
        `<p><strong>${esc(p.candidate_name)}</strong> (${esc(p.candidate_email)}) applied for <strong>${esc(p.position)}</strong>.</p><p>Reference: ${esc(p.reference)}</p>`,
        { label: "Review application", url: hrUrl });

    case "hr_deletion_request":
      return build(`Data deletion request: ${p.candidate_email}`, "GDPR deletion request",
        `<p><strong>${esc(p.candidate_name)}</strong> (${esc(p.candidate_email)}) has requested deletion of their personal data. Please process it within 30 days.</p>`,
        { label: "Review request", url: `${APP_URL}/hr/settings/privacy` });

    default:
      throw new Error(`Unknown email template: ${template}`);
  }
}

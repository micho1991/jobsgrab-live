// Drains public.email_outbox and delivers via Resend.
// Invoked every minute by pg_cron (see supabase/sql/schedule_jobs.sql).
// Auth: shared secret header (x-worker-secret); deploy with --no-verify-jwt.
//
// Required secrets:  RESEND_API_KEY, EMAIL_FROM, EMAIL_WORKER_SECRET, APP_URL
// Optional:          COMPANY_NAME, APP_TIMEZONE, EMAIL_REPLY_TO, EMAIL_DRY_RUN=true
import { createClient } from "jsr:@supabase/supabase-js@2";
import { renderEmail } from "../_shared/templates.ts";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM = Deno.env.get("EMAIL_FROM") ?? "Careers <onboarding@resend.dev>";
const REPLY_TO = Deno.env.get("EMAIL_REPLY_TO");
const WORKER_SECRET = Deno.env.get("EMAIL_WORKER_SECRET");
const DRY_RUN = Deno.env.get("EMAIL_DRY_RUN") === "true" || !RESEND_API_KEY;

interface OutboxRow {
  id: number;
  audience: "user" | "hr";
  recipient_email: string | null;
  template: string;
  payload: Record<string, unknown>;
}

// Which HR staff receive which notification
async function hrRecipients(template: string): Promise<string[]> {
  let q = supabase.from("profiles").select("email");
  if (template === "hr_deletion_request") q = q.eq("role", "hr_admin");
  else {
    q = q.in("role", ["hr_recruiter", "hr_admin"]);
    if (template === "hr_new_registration") q = q.eq("notify_new_registrations", true);
    if (template === "hr_new_application") q = q.eq("notify_new_applications", true);
  }
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).map((r) => r.email).filter(Boolean);
}

async function send(key: string, to: string[], subject: string, html: string, text: string) {
  if (DRY_RUN) {
    console.log(`[dry-run] ${key} → ${to.join(", ")} | ${subject}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": key, // prevents duplicate sends if a batch is retried
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject,
      html,
      text,
      ...(REPLY_TO ? { reply_to: REPLY_TO } : {}),
    }),
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!WORKER_SECRET || req.headers.get("x-worker-secret") !== WORKER_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { data: jobs, error } = await supabase.rpc("claim_email_batch", { p_limit: 25 });
  if (error) {
    console.error("claim_email_batch failed", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  const hrCache = new Map<string, string[]>();
  let sent = 0, failed = 0;

  for (const job of (jobs ?? []) as OutboxRow[]) {
    try {
      let to: string[];
      if (job.audience === "user") {
        to = job.recipient_email ? [job.recipient_email] : [];
      } else {
        if (!hrCache.has(job.template)) hrCache.set(job.template, await hrRecipients(job.template));
        to = hrCache.get(job.template)!;
      }
      if (to.length > 0) {
        const { subject, html, text } = renderEmail(job.template, job.payload);
        // HR recipients get individual emails so addresses aren't shared
        for (const addr of to) await send(`outbox-${job.id}-${addr}`, [addr], subject, html, text);
      }
      await supabase.rpc("complete_email", { p_id: job.id, p_ok: true });
      sent++;
    } catch (e) {
      failed++;
      console.error(`email #${job.id} failed`, e);
      await supabase.rpc("complete_email", { p_id: job.id, p_ok: false, p_error: String(e) });
    }
  }

  return Response.json({ claimed: jobs?.length ?? 0, sent, failed, dry_run: DRY_RUN });
});

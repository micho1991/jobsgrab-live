// Daily maintenance, invoked by pg_cron (see supabase/sql/schedule_jobs.sql).
//  1. Deletes uploads that were never attached to an application (older than 24 h).
//  2. Applies retention: rejected applications are deleted RETENTION_MONTHS
//     (default 12) after the decision, together with their files.
//  3. Prunes operational logs (sent emails, old read notifications, old audit entries).
// Auth: the same shared secret header as send-emails; deploy with --no-verify-jwt.
import { createClient } from "jsr:@supabase/supabase-js@2";

const BUCKET = "candidate-documents";
const SECRET = Deno.env.get("EMAIL_WORKER_SECRET");
const RETENTION_MONTHS = Number(Deno.env.get("RETENTION_MONTHS") ?? 12);

const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

async function removeFiles(paths: string[]): Promise<number> {
  let removed = 0;
  for (let i = 0; i < paths.length; i += 100) {
    const batch = paths.slice(i, i + 100);
    const { data, error } = await admin.storage.from(BUCKET).remove(batch);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
    removed += data?.length ?? 0;
  }
  return removed;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!SECRET || req.headers.get("x-worker-secret") !== SECRET) return new Response("Unauthorized", { status: 401 });

  const summary: Record<string, unknown> = {};
  try {
    const { data: orphans, error: e1 } = await admin.rpc("maintenance_orphaned_uploads", { p_min_age: "24 hours", p_limit: 1000 });
    if (e1) throw e1;
    summary.orphaned_files_removed = await removeFiles((orphans ?? []).map((o: { name: string }) => o.name));

    const { data: expired, error: e2 } = await admin.rpc("maintenance_purge_expired_applications", { p_months: RETENTION_MONTHS, p_limit: 500 });
    if (e2) throw e2;
    const rows = (expired ?? []) as { application_id: string; storage_path: string }[];
    summary.expired_applications = new Set(rows.map((r) => r.application_id)).size;
    // Rows are already deleted in the database; if a file delete fails here, the
    // file becomes an orphan and is removed by step 1 on the next run.
    summary.expired_files_removed = await removeFiles(rows.map((r) => r.storage_path));

    const { data: pruned, error: e3 } = await admin.rpc("maintenance_prune_logs");
    if (e3) throw e3;
    summary.pruned = pruned;

    console.log("maintenance", JSON.stringify(summary));
    return Response.json({ ok: true, ...summary });
  } catch (e) {
    console.error("maintenance failed", e, summary);
    return Response.json({ ok: false, error: String(e), ...summary }, { status: 500 });
  }
});

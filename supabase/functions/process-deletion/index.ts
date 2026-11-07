// Processes a GDPR deletion request. Callable only by an HR admin (verified JWT).
// POST { request_id: string, action: "approve" | "reject", note?: string }
//
// approve → deletes every stored file for the user, deletes the auth user
//           (cascades to profile, applications, documents, notes, history,
//           notifications), marks the request completed and emails a confirmation.
// reject  → marks the request rejected with an optional note and emails the user.
import { createClient } from "jsr:@supabase/supabase-js@2";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUCKET = "candidate-documents";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_URL") ?? "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  // 1. Identify the caller from their JWT and require hr_admin
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(URL_, ANON, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });
  const { data: caller } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (caller?.role !== "hr_admin") return json({ error: "Forbidden" }, 403);

  // 2. Validate input
  let body: { request_id?: string; action?: string; note?: string };
  try { body = await req.json(); } catch { return json({ error: "Invalid JSON" }, 400); }
  const { request_id, action } = body;
  const note = typeof body.note === "string" ? body.note.slice(0, 2000) : null;
  if (!request_id || !["approve", "reject"].includes(action ?? "")) {
    return json({ error: "request_id and action ('approve' | 'reject') are required" }, 400);
  }

  const { data: request } = await admin.from("deletion_requests")
    .select("id, user_id, status").eq("id", request_id).single();
  if (!request) return json({ error: "Request not found" }, 404);
  if (request.status !== "pending") return json({ error: `Request is already ${request.status}` }, 409);
  if (!request.user_id) return json({ error: "User no longer exists" }, 409);

  const { data: subject } = await admin.from("profiles")
    .select("id, email, first_name, role").eq("id", request.user_id).single();
  if (!subject) return json({ error: "User not found" }, 404);

  const finish = async (status: "completed" | "rejected") => {
    await admin.from("deletion_requests").update({
      status, processed_at: new Date().toISOString(), processed_by: user.id, admin_note: note,
    }).eq("id", request_id);
  };

  if (action === "reject") {
    await finish("rejected");
    await admin.from("email_outbox").insert({
      audience: "user", recipient_email: subject.email, template: "deletion_request_rejected",
      payload: { first_name: subject.first_name, note },
    });
    return json({ ok: true, status: "rejected" });
  }

  // Staff accounts must be demoted before they can be erased through this flow
  if (subject.role !== "candidate") {
    return json({ error: "Only candidate accounts can be deleted here. Change the user's role first." }, 409);
  }

  // 3. Delete all stored files (paths are {user_id}/{file})
  let removed = 0;
  for (;;) {
    const { data: files, error } = await admin.storage.from(BUCKET).list(subject.id, { limit: 100 });
    if (error) return json({ error: `Storage list failed: ${error.message}` }, 500);
    if (!files?.length) break;
    const paths = files.map((f) => `${subject.id}/${f.name}`);
    const { error: rmErr } = await admin.storage.from(BUCKET).remove(paths);
    if (rmErr) return json({ error: `Storage delete failed: ${rmErr.message}` }, 500);
    removed += paths.length;
  }

  // 4. Delete the auth user — cascades through all personal data in Postgres
  const { error: delErr } = await admin.auth.admin.deleteUser(subject.id);
  if (delErr) return json({ error: `User deletion failed: ${delErr.message}` }, 500);

  await finish("completed");
  await admin.from("audit_log").insert({
    actor_id: user.id, action: "user_erased", entity: "deletion_request", entity_id: request_id,
    metadata: { files_removed: removed }, // no personal data retained in the log
  });
  await admin.from("email_outbox").insert({
    audience: "user", recipient_email: subject.email, template: "account_deleted",
    payload: { first_name: subject.first_name },
  });

  return json({ ok: true, status: "completed", files_removed: removed });
});

// Maintenance job against real Auth/PostgREST/Storage emulation, checking files on disk.
import { createRequire } from "node:module";
import path from "node:path";
const H = process.env.HARNESS || "/tmp/sb";
const { createClient } = createRequire(path.join(import.meta.dirname, "../../apps/web/package.json"))("@supabase/supabase-js");
import { execSync } from "node:child_process";
import fs from "node:fs";
const keys = fs.readFileSync(`${H}/keys.env`, "utf8");
const ANON = keys.match(/ANON=(.*)/)[1], SERVICE = keys.match(/SERVICE=(.*)/)[1];
const URL = "http://localhost:54321";
const sql = (q) => execSync(`psql -h /tmp -U postgres -d sb -v ON_ERROR_STOP=1 -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
let n = 0; const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); n++; console.log("  ok:", m); };
const onDisk = (p) => fs.existsSync(`${H}/files/candidate-documents/${p}`);

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });
const { data: u } = await admin.auth.admin.createUser({ email: "maint@example.com", password: "Secret123", email_confirm: true, user_metadata: { first_name: "Mia", last_name: "Test" } });
const uid = u.user.id;
const user = createClient(URL, ANON, { auth: { persistSession: false } });
await user.auth.signInWithPassword({ email: "maint@example.com", password: "Secret123" });

const up = async (name) => {
  const path = `${uid}/${crypto.randomUUID()}.pdf`;
  const { error } = await user.storage.from("candidate-documents").upload(path, new Blob(["%PDF-1.4 " + name], { type: "application/pdf" }), { contentType: "application/pdf" });
  if (error) throw error; return path;
};
const submit = async (role) => {
  const docs = [{ kind: "cv", storage_path: await up("cv"), file_name: "cv.pdf" }, { kind: "cover_letter", storage_path: await up("cl"), file_name: "cl.pdf" }];
  const { data, error } = await user.rpc("submit_application", { p_position_id: null, p_other_position: role, p_first_name: "Mia", p_last_name: "Test",
    p_email: "maint@example.com", p_phone: "+38970000000", p_address: "Street 1", p_city: "Ohrid", p_country: "MK", p_additional_info: null,
    p_consent_accuracy: true, p_consent_privacy: true, p_documents: docs });
  if (error) throw error; return { id: data.id, paths: docs.map((d) => d.storage_path) };
};
const old = await submit("Old role");
const recent = await submit("Recent role");
const abandoned = await up("abandoned");
const fresh = await up("in progress");
ok([...old.paths, ...recent.paths, abandoned, fresh].every(onDisk), "6 files uploaded through the Storage API and present on disk");

sql(`update storage.objects set created_at = now() - interval '2 days' where name = '${abandoned}'`);
sql(`update public.applications set status = 'rejected' where id = '${old.id}'`);
sql(`update public.applications set status_changed_at = now() - interval '13 months' where id = '${old.id}'`);

const res = await (await fetch(`${URL}/functions/v1/maintenance`, { method: "POST", headers: { "x-worker-secret": "test-cron-secret" } })).json();
console.log("  result:", JSON.stringify(res));
ok(res.ok && res.orphaned_files_removed === 1 && res.expired_applications === 1 && res.expired_files_removed === 2, "job reports 1 orphan and 1 expired application (2 files)");
ok(!onDisk(abandoned) && sql(`select count(*) from storage.objects where name = '${abandoned}'`) === "0", "abandoned upload deleted from storage");
ok(onDisk(fresh), "an upload still in progress (under 24 h) is kept");
ok(old.paths.every((p) => !onDisk(p)) && sql(`select count(*) from public.applications where id = '${old.id}'`) === "0", "expired rejected application and its files deleted");
ok(recent.paths.every(onDisk) && sql(`select count(*) from public.applications where id = '${recent.id}'`) === "1", "recent application and its files kept");
const again = await (await fetch(`${URL}/functions/v1/maintenance`, { method: "POST", headers: { "x-worker-secret": "test-cron-secret" } })).json();
ok(again.ok && again.orphaned_files_removed === 0 && again.expired_applications === 0, "a second run finds nothing left to do");
console.log(`\n✅ ${n} maintenance checks passed`);

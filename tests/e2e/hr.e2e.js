// Stage 4 end-to-end: HR dashboard, permissions, pipeline, positions, team and GDPR.
const { launchBrowser } = require("./browser");
const fs = require("fs");
const H = process.env.HARNESS || "/tmp/sb";
const path = require("path");
const crypto = require("crypto");
const { execSync } = require("child_process");

const BASE = "http://localhost:3000";
const API = "http://localhost:54321";
const SHOTS = `${H}/shots`;
fs.mkdirSync(SHOTS, { recursive: true });
const SERVICE = fs.readFileSync(`${H}/keys.env`, "utf8").match(/SERVICE=(.*)/)[1];

const sql = (q) => execSync(`psql -h /tmp -U postgres -d sb -v ON_ERROR_STOP=1 -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
// Runs q as the given user under RLS and returns q's own output (psql also prints BEGIN/SET/COMMIT tags).
const asUser = (uid, q) => { const out = sql(`begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${uid}","role":"authenticated"}', true); ${q}; commit;`).split("\n"); return out[out.length - 2]; };
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); passed++; console.log("  ok:", m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createUser(email, first, last, role) {
  const r = await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST", headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Secret123", email_confirm: true, user_metadata: { first_name: first, last_name: last } }),
  });
  const id = (await r.json()).id;
  if (role) sql(`update public.profiles set role='${role}' where id='${id}'`);
  return id;
}

// A real file in storage + a submitted application via the production RPC.
function seedApplication(uid, positionTitle, other, who) {
  const files = ["cv", "cover_letter"].map((kind) => {
    const name = `${uid}/${crypto.randomUUID()}.pdf`;
    const body = `%PDF-1.4 ${who} ${kind}\n%%EOF\n`;
    const p = path.join(H, "files/candidate-documents", name);
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, body); fs.writeFileSync(p + ".meta", JSON.stringify({ mimetype: "application/pdf", size: body.length }));
    sql(`insert into storage.objects (bucket_id, name, owner_id, metadata) values ('candidate-documents', '${name}', '${uid}', '{"mimetype":"application/pdf","size":${body.length}}')`);
    return { kind, storage_path: name, file_name: `${who.replace(" ", "_")}_${kind}.pdf` };
  });
  const pos = positionTitle ? `(select id from public.positions where title='${positionTitle}')` : "null";
  const [first, last] = who.split(" ");
  asUser(uid, `select public.submit_application(${pos}, ${other ? `'${other}'` : "null"}, '${first}', '${last}', '${first.toLowerCase()}@example.com', '+38970000000', 'Main street 1', 'Skopje', 'North Macedonia', 'Keen to join.', true, true, '${JSON.stringify(files)}'::jsonb)`);
  return sql(`select id from public.applications where candidate_id='${uid}' order by submitted_at desc limit 1`);
}

(async () => {
  const hana = await createUser("hana@acme.test", "Hana", "Admin", "hr_admin");
  const rita = await createUser("rita@acme.test", "Rita", "Recruiter");          // made a recruiter through the UI
  await createUser("vera@acme.test", "Vera", "Viewer", "hr_viewer");
  const ana = await createUser("ana@example.com", "Ana", "Petrova");
  const bojan = await createUser("bojan@example.com", "Bojan", "Nikolov");
  const ceca = await createUser("ceca@example.com", "Ceca", "Ilievska");
  const anaApp = seedApplication(ana, "Senior Frontend Engineer", null, "Ana Petrova");
  const bojanHr = seedApplication(bojan, "HR Generalist", null, "Bojan Nikolov");
  const bojanFe = seedApplication(bojan, "Senior Frontend Engineer", null, "Bojan Nikolov");
  seedApplication(ceca, null, "Data Scientist", "Ceca Ilievska");
  sql("truncate public.email_outbox");

  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });
  await page.emulateTimezone("Europe/Skopje");
  page.on("dialog", (d) => d.accept());
  const waitPath = (p) => page.waitForFunction((p) => location.pathname === p, { timeout: 15000 }, p);
  const waitText = (t, timeout = 15000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, t);
  const text = () => page.evaluate(() => document.body.innerText);
  const clickBtn = async (label) => {
    for (const b of await page.$$("button")) if ((await b.evaluate((e) => e.textContent.trim())).startsWith(label) && await b.isVisible()) return b.click();
    throw new Error("no button " + label);
  };
  const shot = (n, full = true) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: full });
  const login = async (email) => {
    await page.goto(BASE + "/login");
    await page.type('[name="email"]', email); await page.type('[name="password"]', "Secret123");
    await clickBtn("Sign in"); await page.waitForFunction(() => location.pathname !== "/login", { timeout: 15000 });
  };
  const signOut = async () => { await page.click('form[action="/auth/signout"] button'); await waitPath("/login"); };

  console.log("Overview (HR admin)");
  await login("hana@acme.test"); await waitPath("/hr");
  let t = await text();
  if (!/Candidates\n4/.test(t)) console.log("DEBUG", JSON.stringify(t.slice(t.indexOf("Candidates"), t.indexOf("Candidates") + 200)));
  ok(/Candidates\n4/.test(t) && /Applications\n4/.test(t) && /New\n4/.test(t), "overview counts: 4 candidates, 4 applications, 4 new");
  ok(t.includes("Senior Frontend Engineer\n2") || t.includes("Senior Frontend Engineer\n\n2"), "applications by position chart");
  const byPos = t.slice(t.indexOf("By position"), t.indexOf("Latest applications"));
  ok(byPos.includes("Other (not listed)") && !byPos.includes("Data Scientist"), "free-text 'Other' applications grouped in one bar");
  ok(await page.$('a[href="/hr/applications"] [aria-label="4 new"]'), "sidebar shows 4 new applications");
  await shot("01-overview");

  console.log("Applications table");
  await page.click('a[href="/hr/applications?status=submitted"]'); await waitPath("/hr/applications");
  ok((await text()).includes("4 applications match"), "overview tile opens the filtered list");
  await page.goto(BASE + "/hr/applications");
  await page.type("#q", "petrova"); await page.keyboard.press("Enter"); await waitText("1 application match");
  ok((await text()).includes("Ana Petrova") && !(await text()).includes("Bojan"), "search by last name");
  await page.$eval("#q", (e) => (e.value = "")); await page.type("#q", "bojan@"); await page.keyboard.press("Enter");
  await waitText("2 applications match"); ok(true, "search by email");
  await clickBtn("Clear filters"); await waitText("4 applications match");
  await page.select("#f-position", sql("select id from public.positions where title='Senior Frontend Engineer'"));
  await waitText("2 applications match"); ok(true, "filter by position");
  await page.select("#f-position", "other"); await waitText("1 application match");
  ok((await text()).includes("Other: Data Scientist"), "filter by 'Other' shows the free-text position");
  await page.select("#f-position", ""); await page.select("#f-status", "submitted"); await waitText("4 applications match");
  ok(true, "filter by status");
  await page.goto(BASE + "/hr/applications?to=2020-01-01"); await waitText("No applications match");
  ok(true, "filter by submission date");
  await page.goto(BASE + "/hr/applications"); await shot("02-applications");

  console.log("Application detail");
  await page.goto(`${BASE}/hr/applications/${anaApp}`); await waitText("Candidate details");
  t = await text();
  ok(t.includes("ana@example.com") && t.includes("Keen to join.") && t.includes("Ana_Petrova_cv.pdf"), "personal info, additional info and documents shown");
  let signed = null;
  await page.setRequestInterception(true);
  const onReq = (r) => { if (r.url().includes("/object/sign/")) { signed = r.url(); r.abort(); } else r.continue(); };
  page.on("request", onReq);
  await page.click('button[aria-label="Download Ana_Petrova_cv.pdf"]');
  for (let i = 0; i < 40 && !signed; i++) await sleep(200);
  page.off("request", onReq); await page.setRequestInterception(false);
  ok(signed && (await (await fetch(signed)).text()).includes("Ana Petrova cv"), "HR downloads the CV through a signed link");
  ok(sql(`select count(*) from public.audit_log where action='document_accessed' and actor_id='${hana}'`) === "1", "download recorded in the audit log");

  console.log("Internal notes");
  await page.goto(`${BASE}/hr/applications/${anaApp}`); await waitText("Candidates never see these notes");
  await page.type("#new-note", "Strong React portfolio. Fast-track."); await clickBtn("Add note");
  await waitText("Strong React portfolio. Fast-track.");
  ok((await text()).includes("Hana Admin (you)"), "note added with author");
  await clickBtn("Edit"); await page.click('[id^="edit-"]', { clickCount: 3 }); await page.keyboard.down("Control"); await page.keyboard.press("a"); await page.keyboard.up("Control"); await page.keyboard.type("Strong React portfolio. Interview this week.");
  await clickBtn("Save"); await waitText("Interview this week."); ok((await text()).includes("edited"), "note edited");
  ok(asUser(ana, "select count(*) from public.application_notes") === "0", "the candidate still can't read the note");

  console.log("Stage changes");
  await page.select("#status", "shortlisted"); await waitText("will get an email");
  await clickBtn("Update stage"); await waitText("Moved to Shortlisted. Ana has been emailed.");
  ok(sql(`select status from public.applications where id='${anaApp}'`) === "shortlisted", "status saved");
  ok(sql("select count(*) from public.email_outbox where template='application_status_changed'") === "1", "candidate email queued");
  await waitText("Submitted to Shortlisted");
  ok((await text()).includes("by Hana Admin (HR admin)"), "history shows who made the change");

  console.log("Interviews");
  await clickBtn("Schedule an interview"); await clickBtn("Schedule and email Ana");
  await waitText("Choose a date and time"); ok(true, "date is required");
  const when = new Date(Date.now() + 3 * 86400000); when.setHours(10, 30, 0, 0);
  const local = `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}T10:30`;
  await page.$eval('[name="scheduledAt"]', (e, v) => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(e, v); e.dispatchEvent(new Event("input", { bubbles: true })); }, local);
  await clickBtn("Schedule and email Ana"); await waitText("Add the meeting link for a video interview");
  ok(true, "video interviews need a meeting link");
  await page.type('[name="meetingUrl"]', "https://meet.example.com/ana-fe");
  await page.type("#detailsForCandidate", "You'll meet the frontend lead.");
  await clickBtn("Schedule and email Ana"); await waitText("Interview scheduled. Ana has been emailed");
  const iv = sql("select to_char(scheduled_at at time zone 'Europe/Skopje', 'HH24:MI') || '|' || mode from public.interviews");
  ok(iv === "10:30|video", "interview stored at 10:30 Skopje time (entered in the HR user's local time)");
  ok(sql(`select status from public.applications where id='${anaApp}'`) === "interview_scheduled", "scheduling moves the application to Interview Scheduled");
  await page.waitForFunction(() => document.querySelector("#status")?.value === "interview_scheduled", { timeout: 10000 });
  ok(!(await text()).includes("Moved to Shortlisted"), "stage menu follows the new status (no stale stage or message)");
  ok(sql("select count(*) from public.email_outbox where template='interview_scheduled'") === "1", "invitation email queued");
  await clickBtn("Cancel interview"); await waitText("Interview cancelled. Ana has been emailed");
  ok(sql("select count(*) from public.email_outbox where template='interview_cancelled'") === "1", "cancellation email queued");
  await shot("03-application-detail");

  console.log("Candidate profile and history");
  await page.goto(`${BASE}/hr/applications/${bojanHr}`); await waitText("Other applications from this candidate");
  ok((await text()).includes("Senior Frontend Engineer"), "other applications by the same candidate listed");
  await page.click(`a[href="/hr/candidates/${bojan}"]`); await waitText("Application history (2)");
  ok(true, "candidate profile shows full application history");

  console.log("Kanban pipeline");
  await page.goto(BASE + "/hr/pipeline"); await page.waitForSelector(`[data-card="${bojanHr}"]`);
  await shot("04-pipeline", false);
  const handle = await page.$(`[data-card="${bojanHr}"] button[aria-label^="Drag"]`);
  const hb = await handle.boundingBox();
  const col = await (await page.$('[data-column="under_review"]')).boundingBox();
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2); await page.mouse.down();
  for (let i = 1; i <= 15; i++) { await page.mouse.move(hb.x + (col.x + col.width / 2 - hb.x) * i / 15, hb.y + (col.y + 60 - hb.y) * i / 15); await sleep(20); }
  await page.mouse.up();
  await waitText("Bojan Nikolov moved to Under Review");
  ok(sql(`select status from public.applications where id='${bojanHr}'`) === "under_review", "drag and drop moves the candidate and saves");
  ok(await page.$(`[data-column="under_review"] [data-card="${bojanHr}"]`), "card now sits in the Under Review column");
  const cecaApp = sql(`select id from public.applications where candidate_id='${ceca}'`);
  await page.select(`[data-card="${cecaApp}"] select`, "rejected");
  await waitText("Ceca Ilievska moved to Rejected");
  ok(sql(`select status from public.applications where id='${cecaApp}'`) === "rejected", "keyboard-friendly 'Move to' menu works too");
  await page.goto(`${BASE}/hr/pipeline?position=${sql("select id from public.positions where title='HR Generalist'")}`);
  await page.waitForSelector(`[data-card="${bojanHr}"]`);
  ok(!(await page.$(`[data-card="${anaApp}"]`)), "pipeline filters by position");

  console.log("Positions");
  await page.goto(BASE + "/hr/positions"); await waitText("Live on job board");
  ok((await text()).includes("Finance Analyst") && (await text()).includes("Inactive"), "all positions listed, including inactive ones");
  await page.goto(BASE + "/hr/positions/new"); await clickBtn("Create position"); await waitText("Title is required");
  ok(true, "title is required");
  await page.type('[name="title"]', "Data Scientist"); await page.type('[name="department"]', "Analytics"); await page.type('[name="location"]', "Remote");
  await page.type("#description", "Build forecasting models for our hiring data.");
  await clickBtn("Create position"); await waitPath("/hr/positions"); await waitText('Saved “Data Scientist”');
  let board = await (await fetch(BASE + "/")).text();
  ok(board.includes("Data Scientist") && board.includes("Build forecasting models"), "new position appears on the public job board");
  const dsRow = await page.evaluateHandle(() => [...document.querySelectorAll("tr")].find((r) => r.innerText.includes("Data Scientist")));
  for (const b of await dsRow.$$("button")) if ((await b.evaluate((e) => e.textContent)) === "Deactivate") { await b.click(); break; }
  await page.waitForFunction(() => [...document.querySelectorAll("tr")].find((r) => r.innerText.includes("Data Scientist"))?.innerText.includes("Inactive"));
  board = await (await fetch(BASE + "/")).text();
  ok(!board.includes("Data Scientist"), "deactivated position disappears from the job board");
  const dsId = sql("select id from public.positions where title='Data Scientist'");
  await page.goto(`${BASE}/hr/positions/${dsId}`); await clickBtn("Delete position"); await waitPath("/hr/positions");
  ok(sql("select count(*) from public.positions where title='Data Scientist'") === "0", "position without applications can be deleted");
  await page.goto(`${BASE}/hr/positions/${sql("select id from public.positions where title='Senior Frontend Engineer'")}`);
  ok((await text()).includes("can’t be deleted"), "position with applications can only be deactivated");

  console.log("Team");
  await page.goto(BASE + "/hr/settings");
  await page.type('[name="email"]', "nobody@acme.test"); await clickBtn("Give HR access"); await waitText("No account uses nobody@acme.test");
  ok(true, "unknown email explained");
  ok((await page.$eval('[name="email"]', (e) => e.value)) === "nobody@acme.test", "typed email kept after an error");
  await page.click('[name="email"]', { clickCount: 3 }); await page.keyboard.type("rita@acme.test");
  await clickBtn("Give HR access"); await waitText("rita@acme.test now has HR access");
  ok(sql(`select role from public.profiles where id='${rita}'`) === "hr_recruiter", "existing account promoted to recruiter");
  ok(!(await page.$(`#role-${hana}`)), "admins can't change their own role");
  await page.click('[name="registrations"]'); await clickBtn("Save preferences"); await waitText("Notification preferences saved");
  ok(sql(`select notify_new_registrations from public.profiles where id='${hana}'`) === "f", "notification preference saved");
  await shot("05-team");

  console.log("GDPR requests");
  asUser(ceca, "select public.request_account_deletion('Please remove my data')");
  asUser(bojan, "select public.request_account_deletion(null)");
  await page.goto(BASE + "/hr/settings/privacy"); await waitText("Waiting for review (2)");
  ok((await text()).includes("“Please remove my data”") && (await text()).includes("30 days left"), "pending requests shown with reason and deadline");
  const items = await page.$$("li");
  for (const li of items) {
    if ((await li.evaluate((e) => e.innerText)).includes("Bojan Nikolov")) {
      for (const b of await li.$$("button")) if ((await b.evaluate((e) => e.textContent)) === "Reject") { await b.click(); break; }
      await page.type('textarea[id^="note-"]', "You have an active job offer with us.");
      for (const b of await li.$$("button")) if ((await b.evaluate((e) => e.textContent)).includes("Reject request")) { await b.click(); break; }
      break;
    }
  }
  await waitText("Request rejected and the person has been emailed");
  ok(sql("select count(*) from public.email_outbox where template='deletion_request_rejected'") === "1", "rejection emailed with the reason");
  await page.reload(); await waitText("Waiting for review (1)");
  const cecaFiles = sql(`select count(*) from storage.objects where owner_id='${ceca}'`);
  await clickBtn("Delete all data"); await waitText("Deleted.", 30000);
  ok((await text()).includes(`${cecaFiles} files removed`), `Edge Function deleted ${cecaFiles} stored files`);
  ok(sql(`select count(*) from auth.users where id='${ceca}'`) === "0" && sql(`select count(*) from public.applications where candidate_id='${ceca}'`) === "0",
     "account, profile and applications erased");
  ok(sql(`select count(*) from storage.objects where owner_id='${ceca}'`) === "0", "no files left in storage");
  ok(sql("select status from public.deletion_requests where reason='Please remove my data'") === "completed", "request marked completed");
  ok(sql("select count(*) from public.email_outbox where template='account_deleted'") === "1", "confirmation email queued");
  await signOut();

  console.log("Recruiter permissions");
  await login("rita@acme.test"); await waitPath("/hr");
  ok(!(await page.$('a[href="/hr/settings/privacy"]')), "recruiter doesn't see privacy requests");
  await page.goto(`${BASE}/hr/applications/${bojanFe}`); await waitText("Stage");
  await page.select("#status", "under_review"); await clickBtn("Update stage"); await waitText("Moved to Under Review");
  ok(true, "recruiter can change stages");
  await page.goto(BASE + "/hr/positions"); ok((await text()).includes("Only HR admins can create or change positions"), "recruiter sees positions read-only");
  await page.goto(BASE + "/hr/positions/new"); await waitPath("/hr/positions"); ok(true, "recruiter can't open the new position form");
  await signOut();

  console.log("Viewer permissions");
  await login("vera@acme.test"); await waitPath("/hr");
  await page.goto(`${BASE}/hr/applications/${anaApp}`); await waitText("Internal notes");
  t = await text();
  ok(t.includes("Interview this week.") && !(await page.$("#status")) && !(await page.$("#new-note")), "viewer reads notes but can't change the stage or write notes");
  ok(!t.includes("Schedule an interview"), "viewer can't schedule interviews");
  const forged = await page.evaluate(async () => document.body.innerText);
  await page.goto(BASE + "/hr/pipeline");
  ok((await text()).includes("view-only access") && !(await page.$('button[aria-label^="Drag"]')), "viewer sees the pipeline without drag handles");
  await page.goto(BASE + "/hr/settings/privacy"); await waitPath("/hr"); ok(true, "viewer is redirected away from privacy requests");
  ok(asUser(sql("select id from public.profiles where email='vera@acme.test'"), `update public.applications set status='hired' where id='${anaApp}'`) === "UPDATE 0",
     "database also blocks a viewer's direct update");
  await signOut();

  console.log("Candidates can't reach HR");
  await login("ana@example.com"); await page.goto(BASE + "/hr/applications"); await waitPath("/dashboard");
  ok(true, "candidate is redirected away from HR pages");
  await signOut();

  console.log("Responsive");
  await login("hana@acme.test");
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + "/hr"); await sleep(300); await shot("06-mobile-overview", false);
  await page.goto(BASE + "/hr/pipeline"); await sleep(300); await shot("07-mobile-pipeline", false);

  await browser.close();
  console.log(`\n✅ ${passed} Stage 4 end-to-end checks passed`);
})().catch((e) => { console.error(e.message); process.exit(1); });

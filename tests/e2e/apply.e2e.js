// Stage 3 end-to-end: application form, uploads, candidate dashboard, status tracking.
const { launchBrowser } = require("./browser");
const fs = require("fs");
const H = process.env.HARNESS || "/tmp/sb";
const path = require("path");
const { execSync } = require("child_process");

const BASE = "http://localhost:3000";
const API = "http://localhost:54321";
const F = path.join(__dirname, "fixtures");
const SHOTS = `${H}/shots`;
fs.mkdirSync(SHOTS, { recursive: true });
const SERVICE = fs.readFileSync(`${H}/keys.env`, "utf8").match(/SERVICE=(.*)/)[1];

const sql = (q) => execSync(`psql -h /tmp -U postgres -d sb -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); passed++; console.log("  ok:", m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createUser(email, first, last) {
  const r = await fetch(`${API}/auth/v1/admin/users`, {
    method: "POST", headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Secret123", email_confirm: true, user_metadata: { first_name: first, last_name: last } }),
  });
  if (!r.ok) throw new Error("createUser " + (await r.text()));
  return (await r.json()).id;
}

(async () => {
  const anaId = await createUser("ana@example.com", "Ana", "Petrova");
  await createUser("bojan@example.com", "Bojan", "Nikolov");
  const frontendId = sql("select id from public.positions where title='Senior Frontend Engineer'");
  const closedId = sql("select id from public.positions where title='Finance Analyst'");

  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 900 });
  await page.emulateTimezone("Europe/Skopje");
  const waitPath = (p) => page.waitForFunction((p) => location.pathname.startsWith(p), { timeout: 15000 }, p);
  const waitText = (t) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout: 15000 }, t);
  const text = () => page.evaluate(() => document.body.innerText);
  const clickBtn = async (label) => {
    for (const b of await page.$$("button")) if ((await b.evaluate((e) => e.textContent.trim())).startsWith(label)) return b.click();
    throw new Error("no button " + label);
  };
  const type = async (name, v) => { await page.$eval(`[name="${name}"]`, (e) => e.select?.()); await page.type(`[name="${name}"]`, v); };
  const shot = (n, full = true) => page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: full });
  const login = async (email) => {
    await page.goto(BASE + "/login"); await page.type('[name="email"]', email); await page.type('[name="password"]', "Secret123");
    await clickBtn("Sign in"); await waitPath("/dashboard");
  };

  console.log("Start from the job board");
  await login("ana@example.com");
  await page.goto(BASE); await page.click("details summary"); await sleep(150);
  for (const a of await page.$$("a")) if ((await a.evaluate((e) => e.textContent)) === "Apply for this position") { await a.click(); break; }
  await waitPath("/apply/" + frontendId);
  ok((await text()).includes("Apply for Senior Frontend Engineer"), "apply link opens the form for that position");
  ok((await page.$eval("#positionId", (e) => e.value)) === frontendId, "position is preselected");
  const options = await page.$$eval("#positionId option", (os) => os.map((o) => o.textContent));
  ok(options.some((o) => o.startsWith("Other")) && !options.includes("Finance Analyst"), "dropdown offers open positions + Other, not closed ones");
  await shot("01-step-position");
  await clickBtn("Continue");

  console.log("Step 2: personal details");
  await waitText("Personal details");
  ok((await page.$eval('[name="firstName"]', (e) => e.value)) === "Ana" && (await page.$eval('[name="email"]', (e) => e.value)) === "ana@example.com",
     "name and email pre-filled from the account");
  await clickBtn("Continue"); await waitText("Enter a valid phone number");
  ok((await text()).includes("Address is required") && (await text()).includes("City is required"), "missing details flagged before moving on");
  await type("phone", "+389 70 123 456"); await type("address", "Bulevar Turistichka 12"); await type("city", "Ohrid"); await type("country", "North Macedonia");
  await clickBtn("Continue");

  console.log("Step 3: documents");
  await waitText("CV / Resume");
  await clickBtn("Continue"); await waitText("Upload your CV to continue");
  ok((await text()).includes("Upload a cover letter to continue"), "CV and cover letter are required");
  let inputs = await page.$$('input[type="file"]');
  await inputs[0].uploadFile(`${F}/notes.txt`); await waitText("Only PDF, DOC and DOCX files are accepted");
  ok(true, "a .txt file is rejected before upload");
  inputs = await page.$$('input[type="file"]');
  await inputs[0].uploadFile(`${F}/Ana_Petrova_CV.pdf`); await waitText("Ana_Petrova_CV.pdf");
  inputs = await page.$$('input[type="file"]');
  await inputs[0].uploadFile(`${F}/Cover_letter.docx`); await waitText("Cover_letter.docx");
  inputs = await page.$$('input[type="file"]');
  await inputs[0].uploadFile(`${F}/Certificate.pdf`); await waitText("Certificate.pdf");
  ok(sql(`select count(*) from storage.objects where owner_id='${anaId}'`) === "3", "three files uploaded to the candidate's private folder");
  await shot("02-step-documents");
  // remove the certificate again
  const removes = await page.$$('button[aria-label^="Remove"]'); await removes[2].click();
  await page.waitForFunction(() => !document.body.innerText.includes("Certificate.pdf"));
  await sleep(500);
  ok(sql(`select count(*) from storage.objects where owner_id='${anaId}'`) === "2", "removing a file deletes it from storage");
  inputs = await page.$$('input[type="file"]'); await inputs[0].uploadFile(`${F}/Certificate.pdf`); await waitText("Certificate.pdf");
  await clickBtn("Continue");

  console.log("Step 4: additional information");
  await waitText("Is there anything else you would like us to know");
  await page.type("#additionalInfo", "Five years building React apps. Available from January.");
  ok((await text()).includes("55 / 5,000"), "live character counter");
  await clickBtn("Continue");

  console.log("Step 5: review and consent");
  await waitText("Review and submit");
  const review = await text();
  ok(review.includes("Senior Frontend Engineer") && review.includes("Bulevar Turistichka 12, Ohrid, North Macedonia")
     && review.includes("Cover_letter.docx") && review.includes("Available from January"), "review shows every answer");
  await clickBtn("Submit application"); await waitText("Please confirm your information is accurate");
  ok((await text()).includes("Please accept the Privacy Policy"), "both consents are required");
  await shot("03-step-review");
  await page.click("#consentAccuracy"); await page.click("#consentPrivacy");
  await clickBtn("Submit application");
  await waitPath("/dashboard/applications/");
  const appId = page.url().split("/applications/")[1].split("?")[0];

  console.log("Application page");
  await waitText("Your application has been submitted");
  const t = await text();
  ok(t.includes("Senior Frontend Engineer") && /Reference APP-\d{6}/.test(t), "lands on the application with its reference number");
  ok(t.includes("We’ve received your application."), "progress tracker shows the Submitted stage");
  ok(sql(`select count(*) from public.documents where application_id='${appId}'`) === "3", "CV, cover letter and certificate recorded");
  ok(sql(`select consent_accuracy and consent_privacy and privacy_policy_version='1.0' from public.applications where id='${appId}'`) === "t", "consent recorded with policy version");
  ok(sql("select string_agg(template, ',' order by id) from public.email_outbox where template like '%application%'") === "application_submitted,hr_new_application",
     "confirmation email to candidate + notification to HR queued");
  ok(sql(`select phone from public.profiles where id='${anaId}'`) === "+389 70 123 456", "details saved back to the profile");
  await shot("04-application-submitted");

  console.log("Download a document");
  let signed = null;
  await page.setRequestInterception(true);
  const onReq = (r) => { if (r.url().includes("/storage/v1/object/sign/")) { signed = r.url(); r.abort(); } else r.continue(); };
  page.on("request", onReq);
  await page.click('button[aria-label="Download Ana_Petrova_CV.pdf"]');
  for (let i = 0; i < 40 && !signed; i++) await sleep(200);
  page.off("request", onReq); await page.setRequestInterception(false);
  const dl = await fetch(signed);
  ok(dl.ok && (await dl.text()) === fs.readFileSync(`${F}/Ana_Petrova_CV.pdf`, "utf8") && dl.headers.get("content-disposition")?.includes("Ana_Petrova_CV.pdf"),
     "download uses a short-lived signed link and returns the original file");

  console.log("Replace the CV and add a document");
  await page.goto(`${BASE}/dashboard/applications/${appId}`);
  let [chooser] = await Promise.all([page.waitForFileChooser(), clickBtn("Replace")]);
  await chooser.accept([`${F}/Ana_Petrova_CV_v2.pdf`]);
  await waitText("Your cv / resume was replaced with Ana_Petrova_CV_v2.pdf");
  await page.waitForFunction(() => !!document.querySelector('button[aria-label="Download Ana_Petrova_CV_v2.pdf"]'), { timeout: 15000 });
  ok(sql(`select count(*) from public.documents where application_id='${appId}' and kind='cv' and replaced_at is not null`) === "1",
     "old CV kept for HR history, marked as replaced");
  ok(!(await page.$('button[aria-label="Download Ana_Petrova_CV.pdf"]')), "candidate sees only the current CV");
  [chooser] = await Promise.all([page.waitForFileChooser(), clickBtn("Add a document")]);
  await chooser.accept([`${F}/Certificate.pdf`]);
  await waitText("Certificate.pdf was added");
  ok(sql(`select count(*) from public.documents where application_id='${appId}' and kind='other'`) === "2", "additional document attached");

  console.log("Dashboard and notifications");
  await page.goto(BASE + "/dashboard");
  const d = await text();
  ok(d.includes("Senior Frontend Engineer") && d.includes("Submitted") && d.includes("Application received"), "dashboard lists the application and the update");
  ok(await page.$('a[href="/dashboard"] [aria-label="1 unread updates"]'), "unread count shown in the navigation");
  await shot("05-dashboard");
  await clickBtn("Mark all as read"); await page.waitForFunction(() => !document.body.innerText.includes("1 new"));
  ok(!(await page.$('[aria-label$="unread updates"]')), "marking as read clears the badge");

  console.log("HR moves the application forward");
  const hrId = await createUser("hr@acme.test", "Hana", "Recruiter");
  sql(`update public.profiles set role='hr_recruiter' where id='${hrId}'`);
  const asHr = (q) => sql(`begin; set local role authenticated; select set_config('request.jwt.claims', '{"sub":"${hrId}","role":"authenticated"}', true); ${q}; commit;`);
  asHr(`update public.applications set status='under_review' where id='${appId}'`);
  asHr(`update public.applications set status='shortlisted' where id='${appId}'`);
  asHr(`insert into public.interviews (application_id, scheduled_at, duration_minutes, mode, meeting_url, details_for_candidate) values ('${appId}', now() + interval '5 days', 45, 'video', 'https://meet.example.com/ana', 'Technical interview with the frontend lead.')`);
  asHr(`insert into public.application_notes (application_id, author_id, body) values ('${appId}', '${hrId}', 'Strong candidate, push for offer.')`);
  await page.goto(`${BASE}/dashboard/applications/${appId}`);
  await page.waitForFunction(() => /CET|GMT\+1/.test(document.body.innerText), { timeout: 8000 }).catch(() => {});
  const p = await text();
  ok(p.includes("Interview Scheduled") && p.includes("Your interview") && p.includes("https://meet.example.com/ana"), "candidate sees the interview with its link");
  const ivUtc = new Date(sql(`select scheduled_at at time zone 'UTC' from public.interviews`) + "Z");
  const expected = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Skopje" }).format(ivUtc);
  if (!p.includes(expected)) console.log("DEBUG:", JSON.stringify(p.slice(p.indexOf("Your interview"), p.indexOf("Your interview") + 140)), "sql:", ivUtc.toISOString());
  ok(p.includes(expected) && /CET|GMT\+1/.test(p), `interview time shown in the candidate's timezone (${expected} CET)`);
  ok(p.includes("Moved to Under Review") && p.includes("Moved to Shortlisted"), "history timeline shows each stage change");
  ok(!p.includes("push for offer"), "internal HR note is not shown to the candidate");
  ok(await page.$('a[href="/dashboard"] [aria-label="3 unread updates"]'), "three new updates waiting");
  await shot("06-interview-scheduled");

  console.log("Apply again and edge cases");
  await page.goto(`${BASE}/apply/${frontendId}`);
  ok((await text()).includes("You've already applied for this position"), "can't apply twice for the same position");
  await page.goto(`${BASE}/apply/${closedId}`);
  ok((await text()).includes("isn't accepting applications"), "closed position can't be applied for");
  await page.goto(`${BASE}/apply/other`);
  ok((await page.$eval(`#positionId option[value="${frontendId}"]`, (o) => o.disabled && o.textContent.includes("already applied"))), "already-applied position is disabled in the dropdown");
  await page.select("#positionId", "other"); await clickBtn("Continue");
  await waitText("Tell us which position you're interested in");
  ok(true, "'Other' requires the position name");

  console.log("Rejection");
  asHr(`update public.applications set status='rejected' where id='${appId}'`);
  await page.goto(`${BASE}/dashboard/applications/${appId}`);
  const r = await text();
  ok(r.includes("We won’t be moving forward this time") && r.includes("Documents can’t be changed"), "rejected application is read-only with a clear message");
  ok(!(await page.$$eval("button", (bs) => bs.some((b) => b.textContent.trim() === "Replace"))), "replace is no longer offered");

  console.log("Privacy between candidates");
  await page.click('form[action="/auth/signout"] button'); await waitPath("/login");
  await login("bojan@example.com");
  const res = await page.goto(`${BASE}/dashboard/applications/${appId}`);
  ok(res.status() === 404 && !(await text()).includes("Ana"), "another candidate gets a 404 for Ana's application");

  console.log("Mobile");
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(`${BASE}/apply/${frontendId}`); await sleep(300); await shot("07-mobile-form", false);

  await browser.close();
  console.log(`\n✅ ${passed} Stage 3 end-to-end checks passed`);
})().catch((e) => { console.error(e.message); process.exit(1); });

// Stage 5: the Expo app (web build of the same code) at phone size against the real backend.
const { launchBrowser } = require("./browser");
const fs = require("fs");
const H = process.env.HARNESS || "/tmp/sb";
const path = require("path");
const { execSync } = require("child_process");

const APP = "http://localhost:8082";
const API = "http://localhost:54321";
const F = path.join(__dirname, "fixtures");
const SHOTS = `${H}/shots`;
fs.mkdirSync(SHOTS, { recursive: true });
const SERVICE = fs.readFileSync(`${H}/keys.env`, "utf8").match(/SERVICE=(.*)/)[1];
const sql = (q) => execSync(`psql -h /tmp -U postgres -d sb -v ON_ERROR_STOP=1 -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
let passed = 0;
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); passed++; console.log("  ok:", m); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function createUser(email, first, last, role) {
  const r = await fetch(`${API}/auth/v1/admin/users`, { method: "POST",
    headers: { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: "Secret123", email_confirm: true, user_metadata: { first_name: first, last_name: last } }) });
  const id = (await r.json()).id;
  if (role) sql(`update public.profiles set role='${role}' where id='${id}'`);
  return id;
}

(async () => {
  await createUser("hana@acme.test", "Hana", "Admin", "hr_admin");
  await createUser("vera@acme.test", "Vera", "Viewer", "hr_viewer");

  const browser = await launchBrowser();
  const page = await browser.newPage(); globalThis.__page = page;
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.emulateTimezone("Europe/Skopje");
  const errors = []; page.on("pageerror", (e) => errors.push(e.message));
  // This single-process Chromium can't open real popup windows, so record where the app sends the new tab.
  await page.evaluateOnNewDocument(() => {
    window.__opened = [];
    window.open = () => ({ close() {}, location: { set href(v) { window.__opened.push(v); } } });
  });
  const lastOpened = async () => { for (let i = 0; i < 40; i++) { const u = await page.evaluate(() => window.__opened.at(-1)); if (u) return u; await sleep(250); } return null; };
  const text = () => page.evaluate(() => document.body.innerText);
  const waitText = (t, timeout = 15000) => page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, t);
  const waitPath = (p) => page.waitForFunction((p) => location.pathname.startsWith(p), { timeout: 15000 }, p);
  // RN-web renders Pressables as role=button / role=tab / role=link elements
  const tap = async (label, { exact = true, role } = {}) => {
    const handle = await page.waitForFunction((label, exact, role) => {
      const sel = role ? `[role="${role}"]` : '[role="button"],[role="tab"],[role="link"],[role="radio"],[role="checkbox"],a';
      return [...document.querySelectorAll(sel)].find((el) => {
        const names = [(el.innerText || "").trim(), (el.getAttribute("aria-label") || "").trim()];
        return names.some((t) => t && (exact ? t === label : t.includes(label))) && el.offsetParent !== null;
      });
    }, { timeout: 15000 }, label, exact, role);
    await handle.asElement().click();
  };
  // Stacked screens stay mounted, so pick the *visible* field with this label.
  const type = async (label, value) => {
    const h = await page.waitForFunction((label) => [...document.querySelectorAll(`input[aria-label="${label}"],textarea[aria-label="${label}"]`)]
      .find((e) => e.offsetParent !== null), { timeout: 15000 }, label);
    const el = h.asElement();
    await el.click({ clickCount: 3 });
    await page.keyboard.down("Control"); await page.keyboard.press("a"); await page.keyboard.up("Control");
    await page.keyboard.press("Backspace");
    await el.type(value);
  };
  const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
  // From any screen (detail screens sit above the tab bar), open the account tab directly.
  const signOut = async (hr = false) => { await page.goto(`${APP}${hr ? "/hr/account" : "/account"}`); await tap("Sign out"); await waitPath("/sign-in"); };
  const signIn = async (email) => { await type("Email", email); await type("Password", "Secret123"); await tap("Sign in"); };

  console.log("Sign in and registration");
  await page.goto(APP); await waitPath("/sign-in"); await sleep(400); await shot("01-sign-in");
  await type("Email", "nobody@example.com"); await type("Password", "Wrong1234"); await tap("Sign in");
  await waitText("The email or password is incorrect."); ok(true, "wrong credentials show a clear error");
  await tap("Create an account", { role: "link" }); await waitPath("/register");
  await type("First name", "Mila"); await type("Last name", "Stojanova"); await type("Email", "mila@example.com");
  await type("Password", "weakpass"); await type("Confirm password", "weakpass"); await tap("Create account");
  await waitText("Include an uppercase letter"); ok(true, "password rules enforced on sign-up");
  await type("Password", "Secret123"); await type("Confirm password", "Secret123"); await tap("Create account");
  await waitPath("/check-email"); await sleep(500);
  if (!(await text()).includes("mila@example.com")) console.log("DEBUG", JSON.stringify((await text()).slice(0, 600)), page.url());
  ok((await text()).includes("mila@example.com"), "sign-up leads to 'check your inbox'");
  const milaId = sql("select id from public.profiles where email='mila@example.com'");
  ok(sql(`select first_name||' '||last_name from public.profiles where id='${milaId}'`) === "Mila Stojanova", "profile created from the app's sign-up");
  await tap("Sign in", { role: "link" }); await waitPath("/sign-in");
  await signIn("mila@example.com"); await waitPath("/check-email");
  ok((await text()).includes("confirm your email address before you can sign in"), "unconfirmed account is sent back to 'check your inbox'");
  sql(`update auth.users set email_confirmed_at=now() where id='${milaId}'`); // the link itself was tested in Stage 2
  await tap("Sign in", { role: "link" }); await waitPath("/sign-in"); await signIn("mila@example.com");
  await waitText("positions open"); ok(true, "confirmed candidate lands on the jobs tab");
  await shot("02-jobs");

  console.log("Apply from the phone");
  await tap("Senior Frontend Engineer", { exact: false }); await tap("Apply for this position"); await waitPath("/apply/");
  await waitText("Step 1 of 5"); await sleep(300);
  ok((await page.$('[role="radio"][aria-checked="true"]')) !== null, "position preselected");
  await tap("Continue"); await waitText("Step 2 of 5");
  ok(await page.evaluate(() => [...document.querySelectorAll('input[aria-label="First name"]')].some((e) => e.offsetParent && e.value === "Mila")), "details pre-filled from the account");
  await tap("Continue"); await waitText("Enter a valid phone number"); ok(true, "missing details flagged");
  await type("Phone number", "+389 71 222 333"); await type("Full address", "Kej Makedonija 5"); await type("City", "Ohrid"); await type("Country", "North Macedonia");
  await tap("Continue"); await waitText("Step 3 of 5"); await tap("Continue"); await waitText("Upload your CV to continue");
  ok(true, "CV and cover letter required");
  let [fc] = await Promise.all([page.waitForFileChooser(), tap("Choose a file")]); await fc.accept([`${F}/notes.txt`]);
  await waitText("Only PDF, DOC and DOCX files are accepted"); ok(true, "wrong file type rejected");
  [fc] = await Promise.all([page.waitForFileChooser(), tap("Choose a file")]); await fc.accept([`${F}/Ana_Petrova_CV.pdf`]); await waitText("Ana_Petrova_CV.pdf");
  [fc] = await Promise.all([page.waitForFileChooser(), tap("Choose a file")]); await fc.accept([`${F}/Cover_letter.docx`]); await waitText("Cover_letter.docx");
  ok(sql(`select count(*) from storage.objects where owner_id='${milaId}'`) === "2", "files uploaded from the phone to private storage");
  await shot("03-apply-documents");
  await tap("Continue"); await waitText("Step 4 of 5");
  await type("Is there anything else you would like us to know about you?", "Available from December.");
  await tap("Continue"); await waitText("Step 5 of 5");
  ok((await text()).includes("Kej Makedonija 5, Ohrid, North Macedonia"), "review shows the answers");
  await tap("Submit application"); await waitText("Please accept the Privacy Policy"); ok(true, "consents required");
  await tap("I confirm that the information I've provided is accurate and complete.", { role: "checkbox" });
  await tap("I accept the", { role: "checkbox", exact: false });
  await shot("04-apply-review");
  await tap("Submit application"); await waitPath("/application/");
  await waitText("Your application has been submitted");
  const appId = sql(`select id from public.applications where candidate_id='${milaId}'`);
  ok(sql(`select count(*) from public.documents where application_id='${appId}'`) === "2", "application and documents saved");
  ok(sql(`select phone from public.profiles where id='${milaId}'`) === "+389 71 222 333", "details saved back to the profile");
  await sleep(300); await shot("05-application");

  console.log("Documents on the phone");
  await tap("Open Ana_Petrova_CV.pdf", { exact: true });
  const url = await lastOpened();
  ok(url && (await (await fetch(url)).text()).startsWith("%PDF"), "document opens through a signed link");
  [fc] = await Promise.all([page.waitForFileChooser(), tap("Replace")]); await fc.accept([`${F}/Ana_Petrova_CV_v2.pdf`]);
  await waitText("was replaced with Ana_Petrova_CV_v2.pdf");
  ok(sql(`select count(*) from public.documents where application_id='${appId}' and kind='cv' and replaced_at is not null`) === "1", "CV replaced (old version kept for HR)");

  console.log("Tabs: applications, updates, account");
  await page.goto(`${APP}/applications`); await waitText("APP-0");
  ok((await text()).includes("Senior Frontend Engineer") && (await text()).includes("Submitted"), "applications tab lists it");
  await tap("Updates", { role: "tab", exact: false }); await waitText("Application received");
  await tap("Mark all as read"); await page.waitForFunction(() => !document.body.innerText.includes("Mark all as read"));
  ok(sql(`select count(*) from public.notifications where user_id='${milaId}' and read_at is null`) === "0", "updates marked as read");
  await tap("Account", { role: "tab", exact: false }); await waitText("Personal details");
  await type("City", "Struga"); await tap("Save profile"); await waitText("Profile saved.");
  ok(sql(`select city from public.profiles where id='${milaId}'`) === "Struga", "profile edited from the phone");
  await shot("06-account");
  await signOut();

  console.log("HR on the phone");
  await signIn("hana@acme.test"); await waitText("By stage");
  ok(page.url().includes("/hr") && !(await text()).includes("Jobs"), "HR staff get the HR area (at /hr), not the candidate tabs");
  await shot("07-hr-overview");
  await tap("Submitted, 1"); await waitText("1 application");
  await type("Search", "stojanova"); await page.keyboard.press("Enter"); await waitText("Mila Stojanova");
  await shot("08-hr-applications");
  await tap("Mila Stojanova", { exact: false }); await waitPath("/hr-application/");
  await waitText("Change stage (now Submitted)");
  await tap("Change stage (now Submitted)"); await tap("Shortlisted", { role: "radio" });
  await waitText("Moved to Shortlisted. Mila has been emailed.");
  ok(sql(`select status from public.applications where id='${appId}'`) === "shortlisted", "HR changes the stage from the phone");
  ok(sql("select count(*) from public.email_outbox where template='application_status_changed'") === "1", "candidate email queued");
  await type("Add a note", "Great portfolio, call this week."); await tap("Add note"); await waitText("Great portfolio, call this week.");
  ok(sql(`select count(*) from public.application_notes where application_id='${appId}'`) === "1", "note added from the phone");
  const before = Number(sql("select count(*) from public.audit_log where action='document_accessed'"));
  await page.evaluate(() => { window.__opened = []; });
  await tap("Open Ana_Petrova_CV_v2.pdf"); await lastOpened();
  ok(Number(sql("select count(*) from public.audit_log where action='document_accessed'")) === before + 1, "HR document access is audited on mobile too");
  await sleep(300); await shot("09-hr-application");
  await signOut(true);

  console.log("Viewer and candidate views");
  await signIn("vera@acme.test"); await waitText("By stage");
  await page.goto(`${APP}/hr-application/${appId}`); await waitText("Internal notes");
  ok(!(await text()).includes("Change stage") && !(await page.$('textarea[aria-label="Add a note"]')), "viewer can read but not change stage or write notes");
  await signOut(true);
  await signIn("mila@example.com"); await waitText("positions open");
  await page.goto(`${APP}/application/${appId}`); await waitText("Moved to Shortlisted");
  ok(!(await text()).includes("Great portfolio"), "candidate sees the new stage but never the HR note");
  await page.goto(`${APP}/hr-application/${appId}`); await sleep(1500);
  ok(!page.url().includes("/hr-application/"), "candidate is redirected away from HR screens");

  ok(errors.length === 0, `no runtime errors in the app (${errors.length})`);
  await browser.close();
  console.log(`\n✅ ${passed} Stage 5 mobile checks passed`);
})().catch(async (e) => {
  console.error(e.message);
  try { const p = globalThis.__page; console.error("URL:", p.url()); console.error("SCREEN:", JSON.stringify((await p.evaluate(() => document.body.innerText)).slice(-700))); await p.screenshot({ path: `${SHOTS}/zz-failure.png` }); } catch {}
  process.exit(1);
});

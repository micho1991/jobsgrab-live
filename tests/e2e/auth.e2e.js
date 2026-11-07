// End-to-end test of Stage 2 against real Supabase Auth + PostgREST + Postgres.
const { launchBrowser } = require("./browser");
const fs = require("fs");
const H = process.env.HARNESS || "/tmp/sb";
const path = require("path");
const { execSync } = require("child_process");

const BASE = "http://localhost:3000";
const MAIL = `${H}/mail`;
const SHOTS = `${H}/shots`;
fs.mkdirSync(SHOTS, { recursive: true });
fs.rmSync(MAIL, { recursive: true, force: true }); fs.mkdirSync(MAIL, { recursive: true });

const sql = (q) => execSync(`psql -h /tmp -U postgres -d sb -Atc "${q.replace(/"/g, '\\"')}"`).toString().trim();
let passed = 0;
const ok = (cond, msg) => { if (!cond) throw new Error("FAIL: " + msg); passed++; console.log("  ok:", msg); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function decodeQP(s) {
  return s.replace(/=\r?\n/g, "").replace(/=([0-9A-F]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}
async function latestLink(to, type) {
  for (let i = 0; i < 40; i++) {
    const files = fs.readdirSync(MAIL).filter((f) => f.includes(to)).sort();
    for (const f of files.reverse()) {
      const body = decodeQP(fs.readFileSync(`${MAIL}/${f}`, "utf8"));
      const m = body.match(new RegExp(`href="(http://localhost:3000/auth/confirm\\?token_hash=[^"]+type=${type}[^"]*)"`));
      if (m) { fs.unlinkSync(`${MAIL}/${f}`); return { url: m[1].replace(/&amp;/g, "&"), body }; }
    }
    await sleep(250);
  }
  throw new Error(`No ${type} email for ${to}`);
}

(async () => {
  const browser = await launchBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 1366, height: 860 });
  const waitPath = (p) => page.waitForFunction((p) => location.pathname === p, { timeout: 15000 }, p);
  const text = () => page.evaluate(() => document.body.innerText);
  const fill = async (vals) => { for (const [n, v] of Object.entries(vals)) { await page.$eval(`[name="${n}"]`, (el) => (el.value = "")); await page.type(`[name="${n}"]`, v); } };
  const submit = async (label) => {
    const btns = await page.$$("button[type=submit]");
    for (const b of btns) if ((await b.evaluate((e) => e.textContent)).includes(label)) return b.click();
    throw new Error("no button " + label);
  };
  const shot = (name, mobile) => page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage: !mobile });

  console.log("Job board");
  await page.goto(BASE);
  ok((await text()).includes("4 positions open"), "public job board lists 4 open positions from the database");
  ok(!(await text()).includes("Finance Analyst"), "closed position is hidden");
  await page.click("details summary"); await sleep(200);
  ok((await text()).includes("Apply for this position"), "position row expands to description + apply button");
  await shot("01-job-board");

  console.log("Registration");
  await page.goto(BASE + "/register"); await sleep(2200); await shot("02-register");
  await fill({ firstName: "Ana", lastName: "Petrova", email: "ana@example.com", password: "weakpass", confirmPassword: "different" });
  await submit("Create account"); await page.waitForSelector("#confirmPassword-error, [id$='-error']");
  const t1 = await text();
  ok(t1.includes("Include an uppercase letter") && t1.includes("Passwords do not match"), "weak password + mismatch shown inline");
  ok((await page.$eval('[name="email"]', (e) => e.value)) === "ana@example.com", "form keeps typed values after an error");
  await shot("03-register-errors");
  await page.$eval('[name="password"]', (e) => (e.value = "")); await page.$eval('[name="confirmPassword"]', (e) => (e.value = ""));
  await page.type('[name="password"]', "Secret123"); await page.type('[name="confirmPassword"]', "Secret123");
  await submit("Create account"); await waitPath("/verify-email");
  ok((await text()).includes("ana@example.com"), "redirected to 'check your inbox' with the address");
  await shot("04-verify-email");
  ok(sql("select first_name||' '||last_name from public.profiles where email='ana@example.com'") === "Ana Petrova", "profile created by trigger from sign-up metadata");
  ok(sql("select count(*) from public.email_outbox where recipient_email='ana@example.com'") === "0", "no welcome email before confirmation");

  console.log("Sign-in before confirming");
  await page.goto(BASE + "/login"); await fill({ email: "ana@example.com", password: "Secret123" });
  await submit("Sign in"); await waitPath("/verify-email");
  ok((await text()).includes("confirm your email address before you can sign in"), "unconfirmed user is sent to verify page");

  console.log("Resend + confirm email");
  await submit("Send a new link"); await page.waitForFunction(() => document.body.innerText.includes("Wait a minute before asking for another"));
  ok(true, "resend within 60s is rate-limited with a clear message");
  const confirm = await latestLink("ana@example.com", "email");
  ok(confirm.body.includes("Confirm your email address") && confirm.body.includes("#0B1F3A"), "branded confirmation email template used");
  await page.goto(confirm.url); await waitPath("/dashboard");
  ok((await text()).includes("Welcome, Ana"), "confirmation link signs in and opens the dashboard");
  ok((await text()).includes("Your account is ready"), "confirmation notice shown");
  ok(sql("select string_agg(template, ',' order by id) from public.email_outbox") === "account_created,hr_new_registration", "welcome email + HR notification queued on confirmation");
  await shot("05-dashboard");

  console.log("Guest-only + sign out");
  await page.goto(BASE + "/login"); await waitPath("/dashboard");
  ok(true, "signed-in user visiting /login goes to dashboard");
  await page.click('form[action="/auth/signout"] button'); await waitPath("/login");
  ok((await text()).includes("signed out"), "sign out works");

  console.log("Sign in");
  await fill({ email: "ana@example.com", password: "Wrong1234" }); await submit("Sign in");
  await page.waitForFunction(() => document.body.innerText.includes("email or password is incorrect"));
  ok(true, "wrong password rejected with clear message");
  await shot("06-login-error");
  await page.$eval('[name="password"]', (e) => (e.value = "")); await page.type('[name="password"]', "Secret123");
  await submit("Sign in"); await waitPath("/dashboard");
  ok(true, "correct password signs in");

  console.log("Deep link return (?next=)");
  await page.click('form[action="/auth/signout"] button'); await waitPath("/login");
  await page.goto(BASE + "/account"); await waitPath("/login");
  await fill({ email: "ana@example.com", password: "Secret123" }); await submit("Sign in"); await waitPath("/account");
  ok(true, "after sign-in the user returns to the page they asked for");

  console.log("Account: profile");
  await fill({ phone: "+389 70 123 456", city: "Ohrid", country: "North Macedonia" });
  await submit("Save profile"); await page.waitForFunction(() => document.body.innerText.includes("Profile saved"));
  ok(sql("select phone||'|'||city from public.profiles where email='ana@example.com'") === "+389 70 123 456|Ohrid", "profile changes saved to database");
  await shot("07-account");

  console.log("Account: password change");
  await fill({ currentPassword: "Nope12345", password: "Newpass123", confirmPassword: "Newpass123" });
  await submit("Change password"); await page.waitForFunction(() => document.body.innerText.includes("current password is incorrect"));
  ok(true, "wrong current password rejected");
  await fill({ currentPassword: "Secret123", password: "Newpass123", confirmPassword: "Newpass123" });
  await submit("Change password"); await page.waitForFunction(() => document.body.innerText.includes("Password changed"));
  await page.click('form[action="/auth/signout"] button'); await waitPath("/login");
  await fill({ email: "ana@example.com", password: "Newpass123" }); await submit("Sign in"); await waitPath("/dashboard");
  ok((await text()).includes("+389 70 123 456"), "new password works; dashboard shows updated profile");

  console.log("Forgot / reset password");
  await page.click('form[action="/auth/signout"] button'); await waitPath("/login");
  await page.goto(BASE + "/forgot-password"); await fill({ email: "ana@example.com" });
  await submit("Send reset link"); await page.waitForFunction(() => document.body.innerText.includes("we've sent a link"));
  ok(true, "reset request acknowledged");
  await page.goto(BASE + "/forgot-password"); await fill({ email: "nobody@example.com" });
  await submit("Send reset link"); await page.waitForFunction(() => document.body.innerText.includes("If an account exists for nobody@example.com"));
  ok(true, "unknown email gets the same response (no account enumeration)");
  const reset = await latestLink("ana@example.com", "recovery");
  await page.goto(reset.url); await waitPath("/reset-password");
  await sleep(300); await shot("08-reset-password");
  await fill({ password: "Reset1234", confirmPassword: "Reset1234" }); await submit("Save new password");
  await waitPath("/dashboard"); ok((await text()).includes("Your password has been changed"), "password reset completes");
  await page.goto(reset.url); await page.waitForFunction(() => location.pathname === "/auth/error");
  ok((await text()).includes("reset link isn't valid"), "used reset link can't be reused");

  console.log("Duplicate registration (no enumeration)");
  await page.goto(BASE + "/dashboard"); await page.click('form[action="/auth/signout"] button'); await waitPath("/login");
  await page.goto(BASE + "/register");
  await fill({ firstName: "X", lastName: "Y", email: "ana@example.com", password: "Secret123", confirmPassword: "Secret123" });
  await submit("Create account"); await waitPath("/verify-email");
  ok(true, "registering an existing email shows the same 'check inbox' page");

  console.log("Google sign-in");
  await page.goto(BASE + "/login");
  await submit("Continue with Google");
  await page.waitForFunction(() => location.href.includes("/auth/v1/authorize"), { timeout: 15000 });
  const u = new URL(page.url());
  ok(u.searchParams.get("provider") === "google" && u.searchParams.get("code_challenge")
     && u.searchParams.get("redirect_to") === "http://localhost:3000/auth/callback?next=%2Fdashboard",
     "Google button starts PKCE OAuth with the correct callback (Google itself is unreachable from the sandbox)");

  console.log("HR access control");
  await page.goto(BASE + "/login"); await fill({ email: "ana@example.com", password: "Reset1234" }); await submit("Sign in"); await waitPath("/dashboard");
  await page.goto(BASE + "/hr"); await waitPath("/dashboard");
  ok(true, "candidate cannot open the HR area");
  sql("update public.profiles set role='hr_admin' where email='ana@example.com'");
  await page.goto(BASE + "/dashboard"); await waitPath("/hr");
  ok((await text()).includes("Overview") && (await text()).includes("Latest applications"), "HR admin is routed to HR overview with live stats");
  await shot("09-hr-overview");
  sql("update public.profiles set role='candidate' where email='ana@example.com'");

  console.log("Data deletion request");
  await page.goto(BASE + "/account");
  await page.click('[name="confirm"]'); await submit("Request deletion");
  await page.waitForFunction(() => document.body.innerText.includes("We received your deletion request on"));
  ok(sql("select status from public.deletion_requests") === "pending", "deletion request stored and confirmed on the page");
  ok(sql("select count(*) from public.email_outbox where template in ('hr_deletion_request','deletion_request_received')") === "2", "deletion emails queued for HR admins and the candidate");
  await page.reload(); ok((await text()).includes("We received your deletion request on"), "pending request persists on the account page");

  console.log("Mobile layouts");
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + "/dashboard"); await sleep(400); await shot("10-mobile-dashboard", true);
  await page.click('form[action="/auth/signout"] button'); await waitPath("/login"); await sleep(400);
  await shot("11-mobile-login", true);
  await page.setViewport({ width: 1366, height: 860 });
  await page.goto(BASE + "/login"); await sleep(2300); await shot("12-login");

  await browser.close();
  console.log(`\n✅ ${passed} end-to-end checks passed`);
})().catch(async (e) => { console.error(e.message); process.exit(1); });

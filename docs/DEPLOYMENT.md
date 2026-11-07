# Going live

A step-by-step path from empty accounts to a running recruitment platform. Do the steps in order: later steps use values from earlier ones. Allow half a day, plus waiting time for DNS and app store review.

Keep a private note (a password manager is ideal) for the values you collect along the way. Anything marked **secret** must never go into the web app's or mobile app's settings, a chat, or a code repository.

## 0. Before you start

You need:

- A domain you control, e.g. `yourcompany.com`, with access to its DNS settings.
- A GitHub account with this repository pushed to it (private is fine).
- Accounts at [Supabase](https://supabase.com), [Resend](https://resend.com), [Vercel](https://vercel.com) and [Google Cloud](https://console.cloud.google.com).
- For the mobile app: an [Expo](https://expo.dev) account, an Apple Developer Program membership ($99/year) and a Google Play Console account ($25 one-time).
- Node 22 and pnpm on your computer, and `pnpm install` run once in the repository.

Decide two addresses now:

- **Careers site:** e.g. `careers.yourcompany.com`
- **Email sending domain:** e.g. `mail.yourcompany.com`, with the sender `Acme Careers <careers@mail.yourcompany.com>`

## 1. Supabase project

1. Create a new project. Choose a region in the EU for GDPR, use a strong database password (**secret**) and store it.
   Free projects are paused after a period of inactivity and have limited backups, so use a paid plan for production.
2. From **Project Settings → API**, note the **Project URL**, the **anon (public) key**, and the **service_role key** (**secret**: it bypasses all security rules; it is only ever used by the Edge Functions).
3. Note the **project ref**, the part before `.supabase.co` in the Project URL.
4. Push the database:
   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   npx supabase db push          # applies the six migrations in supabase/migrations
   ```
   Don't run `seed.sql` in production: it creates sample positions.
5. **Authentication → Providers → Email:** keep *Enable email provider* and *Confirm email* on. Set the minimum password length to 8 with lowercase, uppercase and digits required.
6. **Authentication → Rate Limits:** review the defaults for sign-ups, sign-ins, token refreshes and emails. The defaults suit most companies. The database already limits applications (5 per day), document changes (40 per day) and uploads (60 per day) per candidate.

URL settings and Google sign-in come after the careers site exists (steps 2 and 6).

## 2. Google sign-in

1. In Google Cloud Console create a project, then **APIs & Services → OAuth consent screen**: choose *External*, set the app name, support email, logo and the **authorized domain** `yourcompany.com`, and add the scopes `email`, `profile` and `openid`. Publish the app (status *In production*) so anyone can sign in, not only test users.
2. **Credentials → Create credentials → OAuth client ID → Web application.** Under *Authorized redirect URIs* add:
   `https://<project-ref>.supabase.co/auth/v1/callback`
3. Note the **Client ID** and **Client secret** (**secret**).
4. In Supabase, **Authentication → Providers → Google:** turn it on and paste both values.

The mobile app uses this same web client: no separate iOS or Android client is needed.

## 3. Email with Resend

1. In Resend, **Domains → Add domain** `mail.yourcompany.com`. Add the DNS records it shows (SPF and DKIM) at your DNS provider and wait until the domain shows as verified. Also add a DMARC record (`_dmarc.mail.yourcompany.com`, e.g. `v=DMARC1; p=none; rua=mailto:dmarc@yourcompany.com`); it noticeably improves delivery to Gmail and Outlook.
2. **API Keys → Create** a key with sending access (**secret**).
3. Supabase **Project Settings → Authentication → SMTP Settings:** enable custom SMTP with host `smtp.resend.com`, port `465`, username `resend`, password = the API key, and sender `careers@mail.yourcompany.com` / `Acme Careers`. Account confirmation and password-reset emails now come from your domain.
4. Supabase **Authentication → Email Templates:** paste `supabase/templates/confirmation.html` into *Confirm signup* and `supabase/templates/recovery.html` into *Reset password*. Change "Careers Portal" in both to your company name.

## 4. Edge Functions and scheduled jobs

1. Generate a random shared secret for the scheduled jobs (**secret**):
   ```bash
   openssl rand -hex 32
   ```
2. Set the function secrets, using your values:
   ```bash
   npx supabase secrets set \
     RESEND_API_KEY=re_xxx \
     EMAIL_FROM="Acme Careers <careers@mail.yourcompany.com>" \
     EMAIL_REPLY_TO=hr@yourcompany.com \
     EMAIL_WORKER_SECRET=<the secret from step 1> \
     APP_URL=https://careers.yourcompany.com \
     COMPANY_NAME=Acme \
     APP_TIMEZONE=Europe/Skopje \
     RETENTION_MONTHS=12
   ```
   `SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are provided to functions automatically.
3. Deploy the three functions:
   ```bash
   npx supabase functions deploy send-emails --no-verify-jwt
   npx supabase functions deploy maintenance --no-verify-jwt
   npx supabase functions deploy process-deletion
   ```
4. Open `supabase/sql/schedule_jobs.sql`, replace the three placeholders (your project ref twice, and the secret from step 1), and run it in the Supabase **SQL Editor**. It schedules email delivery every minute and the daily maintenance job (abandoned uploads, retention, log pruning) at 03:17 UTC.
5. Check that both jobs run:
   ```sql
   select jobname, status, return_message, start_time
     from cron.job_run_details join cron.job using (jobid)
    order by start_time desc limit 10;
   ```

## 5. Website on Vercel

1. In Vercel, **Add New → Project**, import the GitHub repository and set:
   - **Root Directory:** `apps/web`. Vercel detects the pnpm workspace and installs from the repository root.
   - **Framework preset:** Next.js (detected automatically).
2. **Environment Variables** (Production):

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | the anon key |
   | `NEXT_PUBLIC_SITE_URL` | `https://careers.yourcompany.com` |
   | `NEXT_PUBLIC_COMPANY_NAME` | `Acme` |
   | `NEXT_PUBLIC_PRIVACY_CONTACT` | `privacy@yourcompany.com` |

   The site needs no secret keys at all: every request runs as the signed-in user and the database enforces permissions.
3. Deploy. Then **Settings → Domains**, add `careers.yourcompany.com` and create the DNS record Vercel shows. HTTPS is set up automatically.
4. If you change any `NEXT_PUBLIC_*` value later, redeploy: they are built into the site.

## 6. Connect the site to Supabase

In Supabase **Authentication → URL Configuration:**

- **Site URL:** `https://careers.yourcompany.com`
- **Redirect URLs:** add all three:
  - `https://careers.yourcompany.com/auth/callback`
  - `https://careers.yourcompany.com/auth/confirm`
  - `hrrecruit://auth/callback` (mobile app)

## 7. Before you invite anyone

1. **Privacy policy.** Have `apps/web/src/app/privacy/page.tsx` reviewed by your legal or privacy adviser and adjust it. If you change it materially later, bump `PRIVACY_POLICY_VERSION` in `packages/shared/src/legal.ts` so new consents record the new version.
2. **Data processing agreements.** Supabase, Resend and Vercel process candidates' personal data for you. Accept each provider's DPA (usually in account or legal settings) and list them as processors in your records.
3. **First HR admin.** Register on the careers site with your work email, confirm it, then run `supabase/sql/bootstrap_first_admin.sql` (with your address) in the SQL Editor. Sign out and back in: you'll land on the HR dashboard.
4. **Team.** Colleagues create an account on the careers site; you then give them a role under **HR → Team and settings**: *HR viewer* (read only), *Recruiter* (stages, notes, interviews) or *HR admin* (also positions, team and privacy requests).
5. **Positions.** Create your open positions under **HR → Positions**.

## 8. Live smoke test (about 20 minutes)

Use a personal email address that isn't on the HR team:

- [ ] Register with email and password. The confirmation email arrives from your domain (check spam the first time) and its link signs you in.
- [ ] Sign out, then sign in with Google.
- [ ] Apply for a position with a real PDF CV and cover letter. You get the confirmation email, and the HR team gets the "new application" email within a minute.
- [ ] As HR, open the application, download the CV, add a note, and move it to *Under Review*. The candidate gets an email, and the update appears in their dashboard. The note doesn't.
- [ ] Schedule an interview with a meeting link. The candidate's email shows the right time in their timezone.
- [ ] As the candidate, replace the CV, then use **Account → Delete your data**. As HR admin, approve it under **Privacy requests** and confirm the person can no longer sign in.
- [ ] Use "Forgot your password?" and complete a reset.
- [ ] The next morning, check that the maintenance job ran (step 4.5).

## 9. Mobile app

Follow [`apps/mobile/README.md`](../apps/mobile/README.md): set the four public values in EAS for the `preview` and `production` environments, build test versions with `eas build --profile preview`, run its real-device checklist, then build and submit with `eas build --profile production` and `eas submit`. For the store privacy questionnaires: the app collects name, email, phone, address and uploaded documents to process job applications; data is encrypted in transit; it does no tracking and no third-party advertising sharing; and account deletion can be requested in the app.

## 10. Running it

**Backups.** Supabase takes daily database backups on paid plans; point-in-time recovery is an add-on worth enabling. Uploaded files live in Supabase Storage. Test a restore once, before you need it.

**Monitoring.**
- *Emails not arriving:* check failed or stuck emails in the SQL Editor:
  ```sql
  select id, template, attempts, last_error, created_at
    from public.email_outbox where status in ('failed', 'pending') order by id desc limit 20;
  ```
  Failed sends are retried 5 times with increasing delays. Also see the Resend dashboard and the `send-emails` function logs.
- *Scheduled jobs:* the `cron.job_run_details` query in step 4.5.
- *Errors:* Vercel → project → **Logs**, and Supabase → **Edge Functions → Logs**.
- *GDPR deadlines:* pending deletion requests show on the HR overview and must be handled within one month.

**Updates.** Every push and pull request runs the full test suite (`.github/workflows/ci.yml`). Merge to `main` only when it's green: Vercel then deploys the site automatically. Database changes ship as new files in `supabase/migrations`, applied with `npx supabase db push`; push migrations *before* deploying code that depends on them. Function changes ship with `npx supabase functions deploy <name>`. Mobile updates ship as new store builds.

**Retention.** Rejected applications are deleted automatically `RETENTION_MONTHS` (default 12, minimum 6) after the decision, with their files. Hired candidates' applications are kept: move what you need into your HR system and delete the rest when appropriate. Sent-email records are kept 30 days, read notifications 12 months, audit entries 24 months.

## Security checklist

- [ ] The service_role key, database password, Resend key, Google client secret and job secret exist only in Supabase function secrets and your password manager.
- [ ] Row-level security is enabled on every table (it is in the migrations; **Database → Tables** shows "RLS enabled").
- [ ] The `candidate-documents` storage bucket is **private**.
- [ ] "Confirm email" is on, and Auth rate limits are reviewed.
- [ ] The site is served only over HTTPS on your domain; security headers and the Content Security Policy are sent automatically.
- [ ] Only the people who need it have *HR admin*; others are *Recruiter* or *HR viewer*.
- [ ] Two-factor authentication is on for the Supabase, Vercel, Resend, Google Cloud, GitHub, Expo, Apple and Google Play accounts.
- [ ] DPAs accepted; privacy policy reviewed.

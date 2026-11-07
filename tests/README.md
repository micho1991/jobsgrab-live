# Tests

| Suite | What it covers | Checks |
|---|---|---|
| `supabase/tests/security_test.sql` | Row-level security, roles, triggers, RPC rules, abuse limits, maintenance functions | 78 |
| `e2e/auth.e2e.js` | Registration, email confirmation, sign-in, Google OAuth start, password change/reset, account, deletion request, HR access control | 33 |
| `e2e/apply.e2e.js` | Application form, uploads, downloads, document replacement, notifications, status tracking, interviews, timezones, rejection, candidate isolation | 37 |
| `e2e/hr.e2e.js` | HR overview, search and filters, audited downloads, notes, stages, interviews, Kanban, positions, team roles, GDPR erasure, viewer/recruiter/admin permissions | 61 |
| `e2e/mobile.e2e.js` | The Expo app (its web build) at phone size: sign-up, applying, documents, updates, profile, HR stage changes, notes, permissions | 30 |
| `e2e/maintenance.e2e.mjs` | Daily job: abandoned uploads and expired applications removed from Storage, recent data kept | 7 |

The browser suites run the real apps against **real Supabase Auth and PostgREST** on Postgres with this repo's migrations, plus the actual Edge Functions under Deno. `harness/gateway.js` stands in for Supabase's API gateway and emulates the Storage API, applying the same `storage.objects` row-level security. Confirmation and reset emails are caught by `harness/smtp_sink.py`, and the tests follow the links in them.

## Run locally (Linux, needs PostgreSQL 16 binaries, Python 3, Node 22)

```bash
pnpm install
tests/harness/setup.sh      # once: downloads Supabase Auth + PostgREST, installs Deno and the test browser
tests/harness/start.sh      # Postgres, SMTP sink, email templates
tests/harness/web.sh        # build + start the web app on :3000
tests/harness/mobile.sh     # export the mobile app for the browser on :8082
tests/harness/run-all.sh    # every suite, each on a freshly reset backend
```

Everything lives in `$HARNESS` (default `/tmp/sb`): logs, screenshots (`shots/`), captured emails (`mail/`). Set `CHROME_PATH` to use an installed Chrome instead of the bundled one.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request: type checks, the web build, compiling the iOS/Android bundles, then the database suite and all end-to-end suites. On failure, logs and screenshots are attached to the run.

## Against your local Supabase

`pnpm db:test` runs the database suite against `supabase start`.

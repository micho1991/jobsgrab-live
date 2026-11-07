# HR Recruitment & Applicant Management Platform

Careers website, HR dashboard and iOS/Android app on one shared Supabase backend.

- **Candidates** register (email or Google), apply with their CV, cover letter and certificates, track every application through seven stages, see interview details, get email and in-app updates, edit their profile, and request deletion of their data.
- **HR teams** get an overview with charts, searchable and filterable applications, candidate profiles, audited document downloads, private notes, stage changes, interview scheduling, a drag-and-drop Kanban pipeline, position management, team roles and a GDPR request queue.
- **Security and privacy** are enforced in the database (row-level security), not just the screens. Files are private, abuse limits apply, there's a strict Content Security Policy, abandoned uploads are cleaned up daily, and rejected applications are deleted 12 months after the decision.

| Document | What's in it |
|---|---|
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | **Going live**, step by step: Supabase, Google, Resend, Vercel, scheduled jobs, first admin, smoke test, operations, security checklist |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Design, data model, security model and key flows |
| [`apps/mobile/README.md`](apps/mobile/README.md) | Running, building and publishing the mobile app |
| [`tests/README.md`](tests/README.md) | The test suites and how to run them |

## Repository layout

```
apps/web/          Next.js website: careers site, candidate dashboard, HR dashboard (/hr)
apps/mobile/       Expo app for iOS and Android
packages/shared/   Validation, statuses, upload rules and messages shared by both apps
supabase/          Migrations, Edge Functions (send-emails, maintenance, process-deletion),
                   auth email templates, scheduled jobs, database tests
tests/             End-to-end suites and the local test backend they run against
.github/workflows/ CI: type checks, builds and every test suite on each change
```

## Develop locally

Prerequisites: Node 22, pnpm, and Docker (the Supabase CLI runs the local backend in Docker).

```bash
pnpm install
cp .env.example .env                             # Google keys are optional locally
pnpm db:start                                    # local Supabase with migrations and sample positions
cp apps/web/.env.example apps/web/.env.local     # paste the anon key printed by db:start
pnpm --filter @hr/web dev                        # http://localhost:3000
```

Local Supabase Studio is at http://127.0.0.1:54323 and the inbox that catches auth emails at http://127.0.0.1:54324. To make yourself an HR admin locally, register, confirm the email, then run `supabase/sql/bootstrap_first_admin.sql` in Studio.

To run the email worker locally, create `supabase/functions/.env` from the Edge Function variables in `.env.example` (leave `RESEND_API_KEY` empty to log emails instead of sending them), then:

```bash
pnpm functions:serve
curl -X POST http://127.0.0.1:54321/functions/v1/send-emails -H "x-worker-secret: <your EMAIL_WORKER_SECRET>"
```

The mobile app: see [`apps/mobile/README.md`](apps/mobile/README.md).

## Tests

246 automated checks: 78 database security and workflow checks, and 168 end-to-end checks covering the website, HR dashboard, mobile app and maintenance job. They run in CI on every push and pull request; see [`tests/README.md`](tests/README.md) to run them yourself.

## Go live

Follow [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). You'll need accounts at Supabase, Resend, Vercel and Google Cloud, a domain with DNS access and, for the app stores, Expo, Apple Developer ($99/year) and Google Play Console ($25 one-time) accounts.

## Roles

| Role | Can do |
|---|---|
| `candidate` | Default for every sign-up. Own profile, own applications, own documents |
| `hr_viewer` | Read all candidates, applications, documents and notes |
| `hr_recruiter` | Viewer + change stages, write notes, schedule interviews |
| `hr_admin` | Recruiter + manage positions, team roles and GDPR deletion requests |

## Configurable decisions

- **CV and cover letter:** both are required on submission, as listed in the brief. To make the cover letter optional, remove the `v_cl` check in `submit_application()` (migration 0002) and the matching check in both application forms.
- **File size:** the upload limit is 10 MB per file. The storage bucket, the `documents` table and `@hr/shared` all enforce it, so change all three together.
- **One application per position:** a candidate can apply to each listed position once. "Other" applications aren't limited per position.
- **Daily abuse limits** (migration 0006): 5 applications, 40 document changes and 60 uploads per candidate per 24 hours.
- **Replacing documents:** candidates can replace their CV or cover letter until the application is Hired or Rejected. Earlier versions stay visible to HR.
- **Retention:** rejected applications are deleted 12 months after the decision (`RETENTION_MONTHS`, minimum 6). Hired applications are kept.

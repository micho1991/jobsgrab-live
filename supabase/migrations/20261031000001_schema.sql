-- =============================================================================
-- 0001 · Core schema: enums, tables, indexes
-- =============================================================================
create extension if not exists pg_trgm with schema extensions;

-- ---------- Enums ------------------------------------------------------------
create type public.app_role as enum ('candidate', 'hr_viewer', 'hr_recruiter', 'hr_admin');

create type public.application_status as enum (
  'submitted', 'under_review', 'shortlisted', 'interview_scheduled',
  'assessment', 'offer_sent', 'hired', 'rejected'
);

create type public.document_kind   as enum ('cv', 'cover_letter', 'other');
create type public.position_status as enum ('open', 'closed');
create type public.employment_type as enum ('full_time', 'part_time', 'contract', 'internship', 'temporary');
create type public.email_status    as enum ('pending', 'processing', 'sent', 'failed');
create type public.deletion_status as enum ('pending', 'completed', 'rejected');
create type public.interview_mode  as enum ('in_person', 'video', 'phone');

-- ---------- Profiles (1:1 with auth.users) -----------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  first_name  text not null default '' check (char_length(first_name) <= 100),
  last_name   text not null default '' check (char_length(last_name)  <= 100),
  phone       text check (phone   is null or char_length(phone)   <= 30),
  address     text check (address is null or char_length(address) <= 255),
  city        text check (city    is null or char_length(city)    <= 100),
  country     text check (country is null or char_length(country) <= 100),
  role        public.app_role not null default 'candidate',
  -- HR notification preferences (ignored for candidates)
  notify_new_registrations boolean not null default true,
  notify_new_applications  boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index profiles_role_idx on public.profiles (role);

-- ---------- Job positions ----------------------------------------------------
create table public.positions (
  id                   uuid primary key default gen_random_uuid(),
  title                text not null check (char_length(title) between 2 and 150),
  department           text check (department is null or char_length(department) <= 100),
  location             text check (location   is null or char_length(location)   <= 150),
  employment_type      public.employment_type not null default 'full_time',
  description          text not null default '' check (char_length(description) <= 20000),
  application_deadline date,
  status               public.position_status not null default 'open',
  is_active            boolean not null default true,
  created_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);
create index positions_listing_idx on public.positions (is_active, status, application_deadline);

-- ---------- Applications -----------------------------------------------------
create sequence public.application_ref_seq start 1001;

create table public.applications (
  id              uuid primary key default gen_random_uuid(),
  reference       text not null unique
                  default ('APP-' || lpad(nextval('public.application_ref_seq')::text, 6, '0')),
  candidate_id    uuid not null references public.profiles (id) on delete cascade,
  position_id     uuid references public.positions (id) on delete restrict,
  other_position  text check (other_position is null or char_length(other_position) between 2 and 150),

  -- Personal information snapshot at time of submission
  first_name      text not null check (char_length(first_name) between 1 and 100),
  last_name       text not null check (char_length(last_name)  between 1 and 100),
  email           text not null check (char_length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone           text not null check (char_length(phone)   between 5 and 30),
  address         text not null check (char_length(address) between 3 and 255),
  city            text not null check (char_length(city)    between 1 and 100),
  country         text not null check (char_length(country) between 2 and 100),
  additional_info text check (additional_info is null or char_length(additional_info) <= 5000),

  -- Consent (both must be true; recorded with policy version + timestamp)
  consent_accuracy       boolean not null check (consent_accuracy),
  consent_privacy        boolean not null check (consent_privacy),
  privacy_policy_version text not null default '1.0',
  consented_at           timestamptz not null default now(),

  status            public.application_status not null default 'submitted',
  status_changed_at timestamptz not null default now(),
  submitted_at      timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  search_text text generated always as (lower(first_name || ' ' || last_name || ' ' || email)) stored,

  constraint applications_position_xor_other
    check ((position_id is not null) <> (other_position is not null))
);
create unique index applications_one_per_position
  on public.applications (candidate_id, position_id) where position_id is not null;
create index applications_candidate_idx on public.applications (candidate_id);
create index applications_position_idx  on public.applications (position_id);
create index applications_status_idx    on public.applications (status, status_changed_at desc);
create index applications_submitted_idx on public.applications (submitted_at desc);
create index applications_search_trgm   on public.applications using gin (search_text extensions.gin_trgm_ops);

-- ---------- Documents (metadata; files live in the private Storage bucket) ---
create table public.documents (
  id             uuid primary key default gen_random_uuid(),
  owner_id       uuid not null references public.profiles (id) on delete cascade,
  application_id uuid not null references public.applications (id) on delete cascade,
  kind           public.document_kind not null,
  storage_path   text not null unique,
  file_name      text not null check (char_length(file_name) between 1 and 255),
  mime_type      text not null check (mime_type in (
                   'application/pdf',
                   'application/msword',
                   'application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  size_bytes     bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  replaced_at    timestamptz,   -- set when superseded by a newer upload (history kept for HR)
  created_at     timestamptz not null default now()
);
-- Exactly one *current* CV and one current cover letter per application
create unique index documents_one_current_per_kind
  on public.documents (application_id, kind)
  where replaced_at is null and kind in ('cv', 'cover_letter');
create index documents_application_idx on public.documents (application_id);
create index documents_owner_idx       on public.documents (owner_id);

-- ---------- Status history ---------------------------------------------------
create table public.application_status_history (
  id             bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  from_status    public.application_status,
  to_status      public.application_status not null,
  changed_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now()
);
create index status_history_app_idx on public.application_status_history (application_id, created_at);

-- ---------- Internal HR notes (NEVER visible to candidates) ------------------
create table public.application_notes (
  id             uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  author_id      uuid references public.profiles (id) on delete set null,
  body           text not null check (char_length(body) between 1 and 5000),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index notes_app_idx on public.application_notes (application_id, created_at desc);

-- ---------- Interviews -------------------------------------------------------
create table public.interviews (
  id                    uuid primary key default gen_random_uuid(),
  application_id        uuid not null references public.applications (id) on delete cascade,
  scheduled_at          timestamptz not null,
  duration_minutes      integer not null default 60 check (duration_minutes between 10 and 480),
  mode                  public.interview_mode not null default 'video',
  location              text check (location    is null or char_length(location) <= 255),
  meeting_url           text check (meeting_url is null or (char_length(meeting_url) <= 500 and meeting_url ~* '^https://')),
  details_for_candidate text check (details_for_candidate is null or char_length(details_for_candidate) <= 2000),
  cancelled_at          timestamptz,
  created_by            uuid references public.profiles (id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);
create index interviews_app_idx on public.interviews (application_id, scheduled_at);

-- ---------- In-app notifications (candidate dashboard + mobile) --------------
create table public.notifications (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  type           text not null,
  title          text not null,
  body           text not null default '',
  application_id uuid references public.applications (id) on delete cascade,
  read_at        timestamptz,
  created_at     timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, created_at desc);

-- ---------- Transactional email outbox (drained by the send-emails function) -
create table public.email_outbox (
  id              bigint generated always as identity primary key,
  audience        text not null check (audience in ('user', 'hr')),
  recipient_email text,
  template        text not null,
  payload         jsonb not null default '{}'::jsonb,
  status          public.email_status not null default 'pending',
  attempts        integer not null default 0,
  last_error      text,
  next_attempt_at timestamptz not null default now(),
  created_at      timestamptz not null default now(),
  sent_at         timestamptz,
  constraint outbox_user_needs_email check (audience <> 'user' or recipient_email is not null)
);
create index email_outbox_pending_idx on public.email_outbox (next_attempt_at) where status = 'pending';

-- ---------- GDPR deletion requests -------------------------------------------
create table public.deletion_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references public.profiles (id) on delete set null,
  reason       text check (reason is null or char_length(reason) <= 2000),
  status       public.deletion_status not null default 'pending',
  requested_at timestamptz not null default now(),
  processed_at timestamptz,
  processed_by uuid references public.profiles (id) on delete set null,
  admin_note   text check (admin_note is null or char_length(admin_note) <= 2000)
);
create unique index deletion_one_pending_per_user
  on public.deletion_requests (user_id) where status = 'pending';

-- ---------- Audit log (document access, deletions, role changes) ------------
create table public.audit_log (
  id         bigint generated always as identity primary key,
  actor_id   uuid references public.profiles (id) on delete set null,
  action     text not null,
  entity     text not null,
  entity_id  text,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

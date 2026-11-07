-- =============================================================================
-- Security & workflow tests. Runs inside a transaction and rolls back.
--   Local Supabase:  psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '"')" -f supabase/tests/security_test.sql
-- Every check prints "ok: ..." / "ok (blocked): ..."; any failure aborts with FAIL.
-- =============================================================================
\set ON_ERROR_STOP 1
begin;

create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

create function tests.ok(cond boolean, msg text) returns void language plpgsql as $$
begin
  if cond is not true then raise exception 'FAIL: %', msg; end if;
  raise notice 'ok: %', msg;
end $$;

create function tests.blocked(p_sql text, msg text) returns void language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    raise notice 'ok (blocked): % -> %', msg, left(sqlerrm, 70);
    return;
  end;
  raise exception 'FAIL (should have been blocked): %', msg;
end $$;

create function tests.login(p_uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
$$;
grant execute on all functions in schema tests to anon, authenticated, service_role;

-- ---------------------------------------------------------------- accounts --
-- A: email sign-up (unconfirmed at first)   B: Google sign-up (confirmed)
-- H: HR admin                               V: HR viewer (read-only)
insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'ana@example.com',   '{"first_name":"Ana","last_name":"Petrova"}', null),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'bojan@example.com', '{"full_name":"Bojan Nikolov","given_name":"Bojan","family_name":"Nikolov"}', now()),
  ('cccccccc-0000-0000-0000-000000000003', 'hr@company.com',    '{"first_name":"Hana","last_name":"Admin"}', now()),
  ('dddddddd-0000-0000-0000-000000000004', 'viewer@company.com','{"first_name":"Vera","last_name":"Viewer"}', now());

update public.profiles set role = 'hr_admin'  where id = 'cccccccc-0000-0000-0000-000000000003';
update public.profiles set role = 'hr_viewer' where id = 'dddddddd-0000-0000-0000-000000000004';

select tests.ok((select first_name || ' ' || last_name from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'Bojan Nikolov',
                'Google metadata mapped to profile name');
select tests.ok(not exists (select 1 from public.email_outbox where template = 'account_created' and recipient_email = 'ana@example.com'),
                'no welcome email before email verification');
update auth.users set email_confirmed_at = now() where id = 'aaaaaaaa-0000-0000-0000-000000000001';
select tests.ok(exists (select 1 from public.email_outbox where template = 'account_created' and recipient_email = 'ana@example.com'),
                'welcome email queued after verification');
select tests.ok((select count(*) from public.email_outbox where template = 'hr_new_registration') = 4,
                'HR notified of every confirmed registration');

-- --------------------------------------------------------------- positions --
set local role authenticated;
select tests.login('cccccccc-0000-0000-0000-000000000003');
insert into public.positions (id, title, status, is_active, application_deadline) values
  ('eeeeeeee-0000-0000-0000-000000000001', 'Backend Engineer', 'open',   true,  current_date + 10),
  ('eeeeeeee-0000-0000-0000-000000000002', 'Closed Role',      'closed', true,  null),
  ('eeeeeeee-0000-0000-0000-000000000003', 'Expired Role',     'open',   true,  current_date - 1);
select tests.ok((select count(*) from public.positions where id::text like 'eeeeeeee%') = 3, 'HR admin creates and sees all positions');

select tests.login('aaaaaaaa-0000-0000-0000-000000000001');
select tests.blocked($$insert into public.positions (title) values ('Hacker role')$$, 'candidate cannot create positions');
select tests.ok((select count(*) from public.positions where id::text like 'eeeeeeee%') = 1,
                'candidate sees only accepting positions (closed + expired hidden)');

reset role;
set local role anon;
select tests.ok((select count(*) from public.positions where id::text like 'eeeeeeee%') = 1, 'anonymous visitor sees only accepting positions');
select tests.blocked($$select * from public.applications$$, 'anonymous cannot read applications');
reset role;

-- ------------------------------------------------------------ file uploads --
set local role authenticated;
select tests.login('aaaaaaaa-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('candidate-documents', 'aaaaaaaa-0000-0000-0000-000000000001/cv-1.pdf',  'aaaaaaaa-0000-0000-0000-000000000001', '{"mimetype":"application/pdf","size":120000}'),
  ('candidate-documents', 'aaaaaaaa-0000-0000-0000-000000000001/cl-1.docx', 'aaaaaaaa-0000-0000-0000-000000000001', '{"mimetype":"application/vnd.openxmlformats-officedocument.wordprocessingml.document","size":40000}'),
  ('candidate-documents', 'aaaaaaaa-0000-0000-0000-000000000001/cv-2.pdf',  'aaaaaaaa-0000-0000-0000-000000000001', '{"mimetype":"application/pdf","size":130000}');
select tests.blocked($$insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('candidate-documents', 'bbbbbbbb-0000-0000-0000-000000000002/evil.pdf', 'aaaaaaaa-0000-0000-0000-000000000001', '{}')$$,
  'candidate cannot upload into another user''s folder');

-- ---------------------------------------------------------- submit (RPC) --
select tests.blocked($$insert into public.applications (candidate_id, other_position, first_name, last_name, email, phone, address, city, country, consent_accuracy, consent_privacy, status)
  values ('aaaaaaaa-0000-0000-0000-000000000001', 'x role', 'A', 'P', 'a@b.co', '12345', 'Street 1', 'Ohrid', 'MK', true, true, 'hired')$$,
  'direct insert bypassing the RPC is denied');

select tests.blocked($$select public.submit_application('eeeeeeee-0000-0000-0000-000000000001', null, 'Ana', 'Petrova', 'ana@example.com', '+38970111222',
  'Street 1', 'Ohrid', 'North Macedonia', null, true, true,
  '[{"kind":"cv","storage_path":"aaaaaaaa-0000-0000-0000-000000000001/cv-1.pdf","file_name":"cv.pdf"}]')$$,
  'submission without cover letter rejected');

select tests.blocked($$select public.submit_application('eeeeeeee-0000-0000-0000-000000000001', null, 'Ana', 'Petrova', 'ana@example.com', '+38970111222',
  'Street 1', 'Ohrid', 'North Macedonia', null, true, false,
  '[{"kind":"cv","storage_path":"aaaaaaaa-0000-0000-0000-000000000001/cv-1.pdf","file_name":"cv.pdf"},{"kind":"cover_letter","storage_path":"aaaaaaaa-0000-0000-0000-000000000001/cl-1.docx","file_name":"cl.docx"}]')$$,
  'submission without privacy consent rejected');

select tests.blocked($$select public.submit_application('eeeeeeee-0000-0000-0000-000000000002', null, 'Ana', 'Petrova', 'ana@example.com', '+38970111222',
  'Street 1', 'Ohrid', 'North Macedonia', null, true, true,
  '[{"kind":"cv","storage_path":"aaaaaaaa-0000-0000-0000-000000000001/cv-1.pdf","file_name":"cv.pdf"},{"kind":"cover_letter","storage_path":"aaaaaaaa-0000-0000-0000-000000000001/cl-1.docx","file_name":"cl.docx"}]')$$,
  'cannot apply to a closed position');

select tests.blocked($$select public.submit_application(null, 'Data Scientist', 'Ana', 'Petrova', 'ana@example.com', '+38970111222',
  'Street 1', 'Ohrid', 'North Macedonia', null, true, true,
  '[{"kind":"cv","storage_path":"bbbbbbbb-0000-0000-0000-000000000002/someone-else.pdf","file_name":"cv.pdf"},{"kind":"cover_letter","storage_path":"aaaaaaaa-0000-0000-0000-000000000001/cl-1.docx","file_name":"cl.docx"}]')$$,
  'cannot attach a file from another user''s folder');

select tests.ok((public.submit_application('eeeeeeee-0000-0000-0000-000000000001', null, ' Ana ', 'Petrova', 'ANA@example.com', '+38970111222',
  'Street 1', 'Ohrid', 'North Macedonia', 'I love building APIs.', true, true,
  '[{"kind":"cv","storage_path":"aaaaaaaa-0000-0000-0000-000000000001/cv-1.pdf","file_name":"Ana CV.pdf"},{"kind":"cover_letter","storage_path":"aaaaaaaa-0000-0000-0000-000000000001/cl-1.docx","file_name":"Cover.docx"}]'
  )).status = 'submitted', 'candidate submits application via RPC');

select tests.blocked($$select public.submit_application('eeeeeeee-0000-0000-0000-000000000001', null, 'Ana', 'Petrova', 'ana@example.com', '+38970111222',
  'Street 1', 'Ohrid', 'North Macedonia', null, true, true,
  '[{"kind":"cv","storage_path":"aaaaaaaa-0000-0000-0000-000000000001/cv-2.pdf","file_name":"cv.pdf"},{"kind":"cover_letter","storage_path":"aaaaaaaa-0000-0000-0000-000000000001/cl-1.docx","file_name":"cl.docx"}]')$$,
  'duplicate application for same position rejected');

select tests.ok((select first_name = 'Ana' and email = 'ana@example.com' from public.applications limit 1), 'input trimmed and email normalised');
select tests.ok((select count(*) from public.documents) = 2, 'candidate sees own 2 documents');
select tests.ok((select size_bytes from public.documents where kind = 'cv') = 120000, 'file size taken from storage metadata, not client');
select tests.ok((select count(*) from public.notifications) = 1, 'in-app "application received" notification created');

do $$
declare n int;
begin
  update public.applications set status = 'hired';
  get diagnostics n = row_count;
  perform tests.ok(n = 0, 'candidate cannot change own application status');
end $$;
select tests.blocked($$update public.profiles set role = 'hr_admin' where id = auth.uid()$$, 'candidate cannot escalate own role');
select tests.blocked($$update public.profiles set email = 'x@y.z' where id = auth.uid()$$, 'candidate cannot change profile email directly');
update public.profiles set phone = '+38970999888', city = 'Ohrid' where id = auth.uid();
select tests.ok((select phone from public.profiles where id = auth.uid()) = '+38970999888', 'candidate edits own profile');

-- ------------------------------------------------- cross-candidate isolation --
select tests.login('bbbbbbbb-0000-0000-0000-000000000002');
select tests.ok((select count(*) from public.applications) = 0, 'other candidate sees no foreign applications');
select tests.ok((select count(*) from public.documents) = 0,    'other candidate sees no foreign documents');
select tests.ok((select count(*) from storage.objects) = 0,     'other candidate cannot list foreign files');
select tests.ok((select count(*) from public.profiles) = 1,     'other candidate sees only own profile');
select tests.ok((select count(*) from public.notifications) = 0, 'other candidate sees no foreign notifications');
select tests.blocked($$select public.hr_overview_stats()$$, 'candidate cannot read HR stats');
select tests.blocked($$select public.add_or_replace_document((select id from public.applications limit 1), 'cv', 'x/y.pdf', 'y.pdf')$$,
  'candidate cannot add documents to someone else''s application');

-- ------------------------------------------------------------------- HR flow --
select tests.login('cccccccc-0000-0000-0000-000000000003');
select tests.ok((select count(*) from public.applications) = 1, 'HR sees all applications');
select tests.ok((select count(*) from storage.objects) = 3,     'HR can access candidate files');
select tests.ok((select count(*) from public.applications where search_text like '%petrova%') = 1, 'search by name works');

insert into public.application_notes (application_id, author_id, body)
select id, auth.uid(), 'Strong API background. Fast-track to interview.' from public.applications;
select tests.blocked($$insert into public.application_notes (application_id, author_id, body)
  select id, 'dddddddd-0000-0000-0000-000000000004', 'spoofed author' from public.applications$$, 'HR cannot post notes as someone else');

update public.applications set status = 'under_review';
select tests.blocked($$update public.applications set first_name = 'Changed'$$, 'HR cannot alter candidate-submitted data');

insert into public.interviews (application_id, scheduled_at, mode, meeting_url, details_for_candidate)
select id, now() + interval '3 days', 'video', 'https://meet.example.com/abc', 'Technical interview with the team lead.' from public.applications;

select tests.ok((select status from public.applications) = 'interview_scheduled', 'scheduling an interview advances the status');
select tests.ok((select created_by from public.interviews) = 'cccccccc-0000-0000-0000-000000000003', 'interview created_by defaults to HR user');
select tests.ok((public.hr_overview_stats() -> 'by_status' ->> 'interview_scheduled')::int = 1, 'HR overview stats');
select public.log_document_access((select id from public.documents where kind = 'cv'));

reset role;
select tests.ok((select count(*) from public.application_status_history) = 3, 'status history: submitted -> under_review -> interview_scheduled');
select tests.ok((select count(*) from public.email_outbox where template = 'application_status_changed') = 1, 'one status email (under_review)');
select tests.ok((select count(*) from public.email_outbox where template = 'interview_scheduled') = 1, 'interview email queued (no duplicate status email)');
select tests.ok((select count(*) from public.email_outbox where template in ('application_submitted', 'hr_new_application')) = 2, 'submission emails to candidate + HR');
select tests.ok((select count(*) from public.audit_log where action = 'document_accessed') = 1, 'document access audited');

-- --------------------------------------------------------- HR viewer limits --
set local role authenticated;
select tests.login('dddddddd-0000-0000-0000-000000000004');
select tests.ok((select count(*) from public.applications) = 1, 'HR viewer can read applications');
select tests.ok((select count(*) from public.application_notes) = 1, 'HR viewer can read notes');
do $$
declare n int;
begin
  update public.applications set status = 'hired';
  get diagnostics n = row_count;
  perform tests.ok(n = 0, 'HR viewer cannot change status');
end $$;
select tests.blocked($$insert into public.application_notes (application_id, author_id, body) select id, auth.uid(), 'x' from public.applications$$,
  'HR viewer cannot write notes');
select tests.blocked($$update public.profiles set role = 'hr_admin' where id = auth.uid()$$, 'HR viewer cannot self-promote');

-- HR admin promotes a candidate (regression: this used to fail on the audit-log write)
select tests.login('cccccccc-0000-0000-0000-000000000003');
update public.profiles set role = 'hr_recruiter' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select tests.ok((select role from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002') = 'hr_recruiter', 'HR admin can change another user''s role');
select tests.ok((select count(*) from public.audit_log where action = 'role_changed') = 1, 'role change is audited');
select tests.blocked($$update public.profiles set role = 'candidate' where id = auth.uid()$$, 'HR admin cannot change own role');
update public.profiles set role = 'candidate' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
select tests.login('dddddddd-0000-0000-0000-000000000004');

-- -------------------------------------------- candidate view after HR actions --
select tests.login('aaaaaaaa-0000-0000-0000-000000000001');
select tests.ok((select count(*) from public.application_notes) = 0, 'internal HR notes are NEVER visible to the candidate');
select tests.ok((select count(*) from public.application_status_history) = 3, 'candidate sees own status timeline');
select tests.ok((select count(*) from public.interviews) = 1, 'candidate sees own interview');
select tests.ok((select count(*) from public.notifications) = 3, 'candidate has 3 notifications');
select tests.ok(public.mark_notifications_read() = 3, 'candidate marks notifications read');
select tests.blocked($$select * from public.email_outbox$$, 'candidate cannot read the email outbox');
select tests.ok((select count(*) from public.audit_log) = 0, 'candidate cannot read the audit log');

-- replace CV: old one is kept for HR history but marked replaced
select public.add_or_replace_document((select id from public.applications), 'cv',
  'aaaaaaaa-0000-0000-0000-000000000001/cv-2.pdf', 'Ana CV v2.pdf');
select tests.ok((select count(*) from public.documents where kind = 'cv' and replaced_at is null) = 1
            and (select count(*) from public.documents where kind = 'cv') = 2, 'CV replaced, previous version retained');
do $$
declare n int;
begin
  delete from storage.objects where name like '%cv-1.pdf';
  get diagnostics n = row_count;
  perform tests.ok(n = 0, 'attached files cannot be deleted by the candidate');
end $$;

select tests.ok((public.request_account_deletion('Found a job elsewhere')).status = 'pending', 'candidate requests data deletion');
select tests.blocked($$select public.request_account_deletion(null)$$, 'only one pending deletion request');

reset role;
-- Worker RPCs are not callable by end users
set local role authenticated;
select tests.blocked($$select * from public.claim_email_batch(10)$$, 'users cannot call the email worker');
reset role;

set local role service_role;
select tests.ok((select count(*) from public.claim_email_batch(100)) >= 8, 'service role claims queued emails');
reset role;

-- ------------------------------------------------------- abuse limits (0006) --
-- Candidate A has 1 application so far; 4 more are allowed today, the 6th is refused.
reset role;
insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'candidate-documents', 'aaaaaaaa-0000-0000-0000-000000000001/rl-' || g || '.pdf', 'aaaaaaaa-0000-0000-0000-000000000001', '{"mimetype":"application/pdf","size":1000}'
  from generate_series(1, 12) g;
set local role authenticated;
select tests.login('aaaaaaaa-0000-0000-0000-000000000001');
do $$
begin
  for i in 1..4 loop
    perform public.submit_application(null, 'Open role ' || i, 'Ana', 'Petrova', 'ana@example.com', '+38970111222',
      'Street 1', 'Ohrid', 'North Macedonia', null, true, true,
      jsonb_build_array(
        jsonb_build_object('kind', 'cv', 'storage_path', 'aaaaaaaa-0000-0000-0000-000000000001/rl-' || (i * 2 - 1) || '.pdf', 'file_name', 'cv.pdf'),
        jsonb_build_object('kind', 'cover_letter', 'storage_path', 'aaaaaaaa-0000-0000-0000-000000000001/rl-' || (i * 2) || '.pdf', 'file_name', 'cl.pdf')));
  end loop;
end $$;
select tests.ok((select count(*) from public.applications) = 5, '5 applications in a day are allowed');
select tests.blocked($$select public.submit_application(null, 'One too many', 'Ana', 'Petrova', 'ana@example.com', '+38970111222',
  'Street 1', 'Ohrid', 'North Macedonia', null, true, true,
  '[{"kind":"cv","storage_path":"aaaaaaaa-0000-0000-0000-000000000001/rl-9.pdf","file_name":"cv.pdf"},{"kind":"cover_letter","storage_path":"aaaaaaaa-0000-0000-0000-000000000001/rl-10.pdf","file_name":"cl.pdf"}]')$$,
  'the 6th application within 24 hours is refused');
reset role;
insert into storage.objects (bucket_id, name, owner_id, metadata)
select 'candidate-documents', 'bbbbbbbb-0000-0000-0000-000000000002/flood-' || g || '.pdf', 'bbbbbbbb-0000-0000-0000-000000000002', '{}'
  from generate_series(1, 60) g;
set local role authenticated;
select tests.login('bbbbbbbb-0000-0000-0000-000000000002');
select tests.blocked($$insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('candidate-documents', 'bbbbbbbb-0000-0000-0000-000000000002/flood-61.pdf', 'bbbbbbbb-0000-0000-0000-000000000002', '{}')$$,
  'more than 60 uploads in 24 hours is refused');

-- ------------------------------------------------------- maintenance (0006) --
select tests.blocked($$select * from public.maintenance_orphaned_uploads()$$, 'users cannot call maintenance functions');
select tests.blocked($$select * from public.maintenance_purge_expired_applications(12)$$, 'users cannot trigger the retention purge');
reset role;
-- an abandoned upload from two days ago, and one from just now
insert into storage.objects (bucket_id, name, owner_id, metadata, created_at) values
  ('candidate-documents', 'aaaaaaaa-0000-0000-0000-000000000001/abandoned.pdf', 'aaaaaaaa-0000-0000-0000-000000000001', '{}', now() - interval '2 days'),
  ('candidate-documents', 'aaaaaaaa-0000-0000-0000-000000000001/in-progress.pdf', 'aaaaaaaa-0000-0000-0000-000000000001', '{}', now());
-- the first application was rejected 13 months ago
update public.applications set status = 'rejected' where other_position = 'Open role 1';
update public.applications set status_changed_at = now() - interval '13 months' where other_position = 'Open role 1';
set local role service_role;
select tests.ok((select array_agg(name) from public.maintenance_orphaned_uploads()) = array['aaaaaaaa-0000-0000-0000-000000000001/abandoned.pdf'],
  'only old, never-attached uploads are reported as orphans');
select tests.blocked($$select * from public.maintenance_purge_expired_applications(3)$$, 'retention below 6 months is refused');
select tests.ok((select count(*) from public.maintenance_purge_expired_applications(12)) = 2, 'expired rejected application returns its 2 files for deletion');
select tests.ok(not exists (select 1 from public.applications where other_position = 'Open role 1'), 'expired rejected application deleted');
select tests.ok(exists (select 1 from public.applications where other_position = 'Open role 2'), 'recent applications are kept');
select tests.ok((select count(*) from public.audit_log where action = 'retention_purge') = 1, 'retention purge is audited');
select tests.ok((public.maintenance_prune_logs() ? 'email_outbox'), 'log pruning runs');
reset role;

rollback;
\echo '✅ All security & workflow tests passed'

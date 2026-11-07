-- =============================================================================
-- 0002 · Helper functions, triggers, RPCs
-- Conventions:
--   * Every SECURITY DEFINER function pins search_path = '' and fully qualifies names.
--   * "Client request" = current_user is anon/authenticated (PostgREST). Inside
--     SECURITY DEFINER functions current_user is the owner, so internal writes
--     are not blocked by the column-protection triggers.
-- =============================================================================

-- ---------- Role helpers (used by RLS policies) ------------------------------
create or replace function public.auth_role()
returns public.app_role
language sql stable security definer set search_path = '' as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_hr()
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select role in ('hr_viewer', 'hr_recruiter', 'hr_admin') from public.profiles where id = auth.uid()),
    false)
$$;

create or replace function public.can_manage_applications()
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(
    (select role in ('hr_recruiter', 'hr_admin') from public.profiles where id = auth.uid()),
    false)
$$;

create or replace function public.is_hr_admin()
returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select role = 'hr_admin' from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.is_client_request()
returns boolean
language sql stable set search_path = '' as $$
  select current_user in ('anon', 'authenticated')
$$;

-- A position accepts applications when active, open and not past its deadline
create or replace function public.position_accepting(
  p_is_active boolean, p_status public.position_status, p_deadline date)
returns boolean
language sql stable set search_path = '' as $$
  select p_is_active and p_status = 'open' and (p_deadline is null or p_deadline >= current_date)
$$;

create or replace function public.status_label(s public.application_status)
returns text
language sql immutable set search_path = '' as $$
  select case s
    when 'submitted'           then 'Submitted'
    when 'under_review'        then 'Under Review'
    when 'shortlisted'         then 'Shortlisted'
    when 'interview_scheduled' then 'Interview Scheduled'
    when 'assessment'          then 'Assessment'
    when 'offer_sent'          then 'Offer Sent'
    when 'hired'               then 'Hired'
    when 'rejected'            then 'Rejected'
  end
$$;

create or replace function public.position_title_for(p_position_id uuid, p_other text)
returns text
language sql stable security definer set search_path = '' as $$
  select coalesce((select title from public.positions where id = p_position_id), p_other, 'Open application')
$$;

-- ---------- Generic updated_at -----------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger profiles_updated_at     before update on public.profiles          for each row execute function public.set_updated_at();
create trigger positions_updated_at    before update on public.positions         for each row execute function public.set_updated_at();
create trigger applications_updated_at before update on public.applications      for each row execute function public.set_updated_at();
create trigger notes_updated_at        before update on public.application_notes for each row execute function public.set_updated_at();
create trigger interviews_updated_at   before update on public.interviews        for each row execute function public.set_updated_at();

-- ---------- Email outbox -----------------------------------------------------
create or replace function public.enqueue_email(
  p_audience text, p_template text, p_recipient text, p_payload jsonb)
returns void
language sql security definer set search_path = '' as $$
  insert into public.email_outbox (audience, template, recipient_email, payload)
  values (p_audience, p_template, p_recipient, coalesce(p_payload, '{}'::jsonb))
$$;

-- ---------- Account lifecycle (auth.users → profiles) -----------------------
create or replace function public.on_account_confirmed(p_user_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v public.profiles;
begin
  select * into v from public.profiles where id = p_user_id;
  if not found or v.role <> 'candidate' then return; end if;

  perform public.enqueue_email('user', 'account_created', v.email,
    jsonb_build_object('first_name', v.first_name));
  perform public.enqueue_email('hr', 'hr_new_registration', null,
    jsonb_build_object('candidate_name', trim(v.first_name || ' ' || v.last_name),
                       'candidate_email', v.email, 'user_id', v.id));
end $$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  meta   jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  v_full text  := trim(coalesce(meta ->> 'full_name', meta ->> 'name', ''));
  v_first text;
  v_last  text;
begin
  -- Email sign-up sends first_name/last_name; Google sends given_name/family_name/full_name
  v_first := left(coalesce(nullif(trim(meta ->> 'first_name'), ''),
                           nullif(trim(meta ->> 'given_name'), ''),
                           nullif(split_part(v_full, ' ', 1), ''), ''), 100);
  v_last  := left(coalesce(nullif(trim(meta ->> 'last_name'), ''),
                           nullif(trim(meta ->> 'family_name'), ''),
                           nullif(trim(substr(v_full, length(split_part(v_full, ' ', 1)) + 2)), ''), ''), 100);

  insert into public.profiles (id, email, first_name, last_name)
  values (new.id, coalesce(new.email, ''), v_first, v_last);

  -- OAuth users arrive already confirmed
  if new.email_confirmed_at is not null then
    perform public.on_account_confirmed(new.id);
  end if;
  return new;
end $$;

create or replace function public.handle_user_updated()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.email_confirmed_at is null and new.email_confirmed_at is not null then
    perform public.on_account_confirmed(new.id);
  end if;
  if new.email is distinct from old.email and new.email is not null then
    update public.profiles set email = new.email where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
create trigger on_auth_user_updated after update on auth.users
  for each row execute function public.handle_user_updated();

-- ---------- Column protection: profiles --------------------------------------
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if public.is_client_request() then
    if new.id <> old.id or new.email is distinct from old.email or new.created_at <> old.created_at then
      raise exception 'These profile fields cannot be changed' using errcode = '42501';
    end if;
    if new.role is distinct from old.role then
      if not public.is_hr_admin() then
        raise exception 'Only HR administrators can change roles' using errcode = '42501';
      end if;
      if new.id = auth.uid() then
        raise exception 'You cannot change your own role' using errcode = '42501';
      end if;
      insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
      values (auth.uid(), 'role_changed', 'profile', new.id::text,
              jsonb_build_object('from', old.role, 'to', new.role));
    end if;
  end if;
  return new;
end $$;

create trigger profiles_protect before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- ---------- Column protection: applications (HR may only change status) -----
create or replace function public.protect_application_columns()
returns trigger
language plpgsql set search_path = '' as $$
declare
  ignored text[] := array['status', 'status_changed_at', 'updated_at', 'search_text'];
begin
  if public.is_client_request()
     and (to_jsonb(new) - ignored) is distinct from (to_jsonb(old) - ignored) then
    raise exception 'Only the application status can be changed' using errcode = '42501';
  end if;
  if new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  return new;
end $$;

create trigger applications_protect before update on public.applications
  for each row execute function public.protect_application_columns();

-- ---------- Application created → history, notification, emails -------------
create or replace function public.on_application_created()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_title text := public.position_title_for(new.position_id, new.other_position);
  v_email text := (select email from public.profiles where id = new.candidate_id);
begin
  insert into public.application_status_history (application_id, from_status, to_status, changed_by)
  values (new.id, null, new.status, new.candidate_id);

  insert into public.notifications (user_id, type, title, body, application_id)
  values (new.candidate_id, 'application_submitted', 'Application received',
          format('Your application for %s (%s) has been submitted.', v_title, new.reference), new.id);

  perform public.enqueue_email('user', 'application_submitted', v_email,
    jsonb_build_object('first_name', new.first_name, 'position', v_title,
                       'reference', new.reference, 'application_id', new.id));
  perform public.enqueue_email('hr', 'hr_new_application', null,
    jsonb_build_object('candidate_name', new.first_name || ' ' || new.last_name,
                       'candidate_email', new.email, 'position', v_title,
                       'reference', new.reference, 'application_id', new.id));
  return new;
end $$;

create trigger applications_after_insert after insert on public.applications
  for each row execute function public.on_application_created();

-- ---------- Status changed → history, notification, email -------------------
create or replace function public.on_application_status_changed()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_title  text := public.position_title_for(new.position_id, new.other_position);
  v_email  text := (select email from public.profiles where id = new.candidate_id);
  v_source text := coalesce(current_setting('app.status_change_source', true), '');
begin
  insert into public.application_status_history (application_id, from_status, to_status, changed_by)
  values (new.id, old.status, new.status, auth.uid());

  -- When the change comes from scheduling an interview, the interview trigger
  -- sends a richer notification/email instead of a generic status one.
  if v_source <> 'interview' then
    insert into public.notifications (user_id, type, title, body, application_id)
    values (new.candidate_id, 'status_changed', 'Application status updated',
            format('Your application for %s is now: %s.', v_title, public.status_label(new.status)), new.id);

    perform public.enqueue_email('user', 'application_status_changed', v_email,
      jsonb_build_object('first_name', new.first_name, 'position', v_title,
                         'reference', new.reference, 'application_id', new.id,
                         'status', new.status, 'status_label', public.status_label(new.status)));
  end if;
  return new;
end $$;

create trigger applications_status_changed after update of status on public.applications
  for each row when (old.status is distinct from new.status)
  execute function public.on_application_status_changed();

-- ---------- Interviews → status, notification, email -------------------------
create or replace function public.interview_payload(i public.interviews, a public.applications)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'first_name', a.first_name,
    'position', public.position_title_for(a.position_id, a.other_position),
    'reference', a.reference, 'application_id', a.id,
    'scheduled_at', i.scheduled_at, 'duration_minutes', i.duration_minutes,
    'mode', i.mode, 'location', i.location, 'meeting_url', i.meeting_url,
    'details', i.details_for_candidate)
$$;

create or replace function public.on_interview_created()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  a public.applications;
begin
  if new.created_by is null then new.created_by := auth.uid(); end if;

  perform set_config('app.status_change_source', 'interview', true);
  update public.applications set status = 'interview_scheduled'
   where id = new.application_id and status in ('submitted', 'under_review', 'shortlisted');
  perform set_config('app.status_change_source', '', true);

  select * into a from public.applications where id = new.application_id;

  insert into public.notifications (user_id, type, title, body, application_id)
  values (a.candidate_id, 'interview_scheduled', 'Interview scheduled',
          format('An interview for %s has been scheduled. Check your email for details.',
                 public.position_title_for(a.position_id, a.other_position)), a.id);

  perform public.enqueue_email('user', 'interview_scheduled',
    (select email from public.profiles where id = a.candidate_id),
    public.interview_payload(new, a));
  return new;
end $$;

-- BEFORE so created_by can be defaulted; the status update targets another table.
create trigger interviews_before_insert before insert on public.interviews
  for each row execute function public.on_interview_created();

create or replace function public.on_interview_updated()
returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  a public.applications;
  v_template text;
begin
  if old.cancelled_at is null and new.cancelled_at is not null then
    v_template := 'interview_cancelled';
  elsif new.cancelled_at is null and (new.scheduled_at <> old.scheduled_at
        or new.mode <> old.mode
        or new.location is distinct from old.location
        or new.meeting_url is distinct from old.meeting_url) then
    v_template := 'interview_updated';
  else
    return new;
  end if;

  select * into a from public.applications where id = new.application_id;
  insert into public.notifications (user_id, type, title, body, application_id)
  values (a.candidate_id, v_template,
          case v_template when 'interview_cancelled' then 'Interview cancelled' else 'Interview updated' end,
          'Details of your interview have changed. Check your email for more information.', a.id);
  perform public.enqueue_email('user', v_template,
    (select email from public.profiles where id = a.candidate_id),
    public.interview_payload(new, a));
  return new;
end $$;

create trigger interviews_after_update after update on public.interviews
  for each row execute function public.on_interview_updated();

-- =============================================================================
-- RPCs called by the apps
-- =============================================================================

-- Internal: verify an uploaded object really exists, belongs to the user and
-- record it. Size and MIME type come from Storage metadata, not the client.
create or replace function public._attach_document(
  p_owner uuid, p_application_id uuid, p_kind public.document_kind,
  p_storage_path text, p_file_name text)
returns public.documents
language plpgsql security definer set search_path = '' as $$
declare
  v_meta jsonb;
  v_name text;
  v_doc  public.documents;
begin
  if p_storage_path is null or split_part(p_storage_path, '/', 1) <> p_owner::text then
    raise exception 'Invalid document path' using errcode = '42501';
  end if;

  select o.metadata into v_meta
    from storage.objects o
   where o.bucket_id = 'candidate-documents'
     and o.name = p_storage_path
     and o.owner_id = p_owner::text;
  if not found then
    raise exception 'Uploaded file not found. Please upload it again.' using errcode = 'P0002';
  end if;

  v_name := left(nullif(trim(regexp_replace(coalesce(p_file_name, ''), '[[:cntrl:]/\\]', '', 'g')), ''), 255);

  insert into public.documents (owner_id, application_id, kind, storage_path, file_name, mime_type, size_bytes)
  values (p_owner, p_application_id, p_kind, p_storage_path,
          coalesce(v_name, 'document'),
          v_meta ->> 'mimetype', (v_meta ->> 'size')::bigint)
  returning * into v_doc;
  return v_doc;
end $$;

-- Atomic submission: application + documents in one transaction.
-- p_documents: [{ "kind": "cv"|"cover_letter"|"other", "storage_path": "...", "file_name": "..." }]
create or replace function public.submit_application(
  p_position_id      uuid,
  p_other_position   text,
  p_first_name       text,
  p_last_name        text,
  p_email            text,
  p_phone            text,
  p_address          text,
  p_city             text,
  p_country          text,
  p_additional_info  text,
  p_consent_accuracy boolean,
  p_consent_privacy  boolean,
  p_documents        jsonb,
  p_privacy_policy_version text default '1.0')
returns public.applications
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_app public.applications;
  v_doc jsonb;
  v_cv  int;
  v_cl  int;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if public.auth_role() is distinct from 'candidate' then
    raise exception 'Only candidate accounts can submit applications' using errcode = '42501';
  end if;
  if not exists (select 1 from auth.users where id = v_uid and email_confirmed_at is not null) then
    raise exception 'Please verify your email address before applying' using errcode = '42501';
  end if;
  if not coalesce(p_consent_accuracy, false) or not coalesce(p_consent_privacy, false) then
    raise exception 'Both consent checkboxes must be accepted' using errcode = '22023';
  end if;

  if p_position_id is not null then
    if not exists (select 1 from public.positions p
                    where p.id = p_position_id
                      and public.position_accepting(p.is_active, p.status, p.application_deadline)) then
      raise exception 'This position is no longer accepting applications' using errcode = 'P0001';
    end if;
    if exists (select 1 from public.applications
                where candidate_id = v_uid and position_id = p_position_id) then
      raise exception 'You have already applied for this position' using errcode = '23505';
    end if;
  end if;

  if p_documents is null or jsonb_typeof(p_documents) <> 'array' or jsonb_array_length(p_documents) > 12 then
    raise exception 'Invalid documents list' using errcode = '22023';
  end if;
  select count(*) filter (where d ->> 'kind' = 'cv'),
         count(*) filter (where d ->> 'kind' = 'cover_letter')
    into v_cv, v_cl
    from jsonb_array_elements(p_documents) d;
  if v_cv <> 1 then raise exception 'Please upload exactly one CV' using errcode = '22023'; end if;
  if v_cl <> 1 then raise exception 'Please upload exactly one cover letter' using errcode = '22023'; end if;

  insert into public.applications (
    candidate_id, position_id, other_position,
    first_name, last_name, email, phone, address, city, country, additional_info,
    consent_accuracy, consent_privacy, privacy_policy_version)
  values (
    v_uid,
    p_position_id,
    case when p_position_id is null then nullif(trim(p_other_position), '') end,
    trim(p_first_name), trim(p_last_name), lower(trim(p_email)), trim(p_phone),
    trim(p_address), trim(p_city), trim(p_country), nullif(trim(p_additional_info), ''),
    true, true, coalesce(p_privacy_policy_version, '1.0'))
  returning * into v_app;

  for v_doc in select * from jsonb_array_elements(p_documents) loop
    perform public._attach_document(v_uid, v_app.id, (v_doc ->> 'kind')::public.document_kind,
                                    v_doc ->> 'storage_path', v_doc ->> 'file_name');
  end loop;

  return v_app;
end $$;

-- Upload an additional document, or replace the current CV / cover letter.
create or replace function public.add_or_replace_document(
  p_application_id uuid, p_kind public.document_kind, p_storage_path text, p_file_name text)
returns public.documents
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
  v_app public.applications;
  v_doc public.documents;
begin
  select * into v_app from public.applications where id = p_application_id and candidate_id = v_uid;
  if not found then
    raise exception 'Application not found' using errcode = 'P0002';
  end if;
  if v_app.status in ('hired', 'rejected') then
    raise exception 'Documents can no longer be changed for this application' using errcode = 'P0001';
  end if;
  if p_kind = 'other' and (select count(*) from public.documents
                            where application_id = p_application_id and kind = 'other'
                              and replaced_at is null) >= 10 then
    raise exception 'You can attach at most 10 additional documents' using errcode = 'P0001';
  end if;

  if p_kind in ('cv', 'cover_letter') then
    update public.documents set replaced_at = now()
     where application_id = p_application_id and kind = p_kind and replaced_at is null;
  end if;

  v_doc := public._attach_document(v_uid, p_application_id, p_kind, p_storage_path, p_file_name);

  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (v_uid, 'document_uploaded', 'application', p_application_id::text,
          jsonb_build_object('kind', p_kind, 'document_id', v_doc.id));
  return v_doc;
end $$;

create or replace function public.mark_notifications_read(p_ids uuid[] default null)
returns integer
language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  update public.notifications set read_at = now()
   where user_id = auth.uid() and read_at is null
     and (p_ids is null or id = any (p_ids));
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.request_account_deletion(p_reason text default null)
returns public.deletion_requests
language plpgsql security definer set search_path = '' as $$
declare
  v_req public.deletion_requests;
  v_p   public.profiles;
begin
  select * into v_p from public.profiles where id = auth.uid();
  if not found then raise exception 'Not authenticated' using errcode = '42501'; end if;
  if exists (select 1 from public.deletion_requests where user_id = v_p.id and status = 'pending') then
    raise exception 'A deletion request is already pending' using errcode = '23505';
  end if;

  insert into public.deletion_requests (user_id, reason)
  values (v_p.id, left(nullif(trim(p_reason), ''), 2000))
  returning * into v_req;

  perform public.enqueue_email('hr', 'hr_deletion_request', null,
    jsonb_build_object('candidate_name', trim(v_p.first_name || ' ' || v_p.last_name),
                       'candidate_email', v_p.email, 'request_id', v_req.id));
  perform public.enqueue_email('user', 'deletion_request_received', v_p.email,
    jsonb_build_object('first_name', v_p.first_name));
  return v_req;
end $$;

-- HR: record that a document was opened/downloaded (call when creating a signed URL)
create or replace function public.log_document_access(p_document_id uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_hr() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id)
  values (auth.uid(), 'document_accessed', 'document', p_document_id::text);
end $$;

-- HR dashboard overview
create or replace function public.hr_overview_stats()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_hr() then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total_candidates',    (select count(*) from public.profiles where role = 'candidate'),
    'total_applications',  (select count(*) from public.applications),
    'new_applications',    (select count(*) from public.applications where status = 'submitted'),
    'new_last_7_days',     (select count(*) from public.applications where submitted_at >= now() - interval '7 days'),
    'by_status', (select coalesce(jsonb_object_agg(s.status, s.n), '{}'::jsonb)
                    from (select status, count(*) as n from public.applications group by status) s),
    'by_position', (select coalesce(jsonb_agg(x order by x.n desc), '[]'::jsonb)
                      from (select public.position_title_for(position_id, other_position) as title, count(*) as n
                              from public.applications
                             group by 1 order by 2 desc limit 10) x),
    'daily_last_30_days', (select jsonb_agg(jsonb_build_object('date', d::date, 'count',
                             (select count(*) from public.applications a
                               where a.submitted_at >= d and a.submitted_at < d + interval '1 day')) order by d)
                             from generate_series(current_date - 29, current_date, interval '1 day') d),
    'upcoming_interviews', (select count(*) from public.interviews
                             where cancelled_at is null and scheduled_at >= now()),
    'pending_deletion_requests', (select count(*) from public.deletion_requests where status = 'pending')
  );
end $$;

-- ---------- Email worker RPCs (service_role only) ----------------------------
create or replace function public.claim_email_batch(p_limit integer default 25)
returns setof public.email_outbox
language sql security definer set search_path = '' as $$
  update public.email_outbox o
     set status = 'processing', attempts = o.attempts + 1, next_attempt_at = now()
   where o.id in (
     select id from public.email_outbox
      where (status = 'pending' and next_attempt_at <= now())
         or (status = 'processing' and next_attempt_at < now() - interval '10 minutes')
      order by id
      limit greatest(1, least(p_limit, 100))
      for update skip locked)
  returning o.*
$$;

create or replace function public.complete_email(p_id bigint, p_ok boolean, p_error text default null)
returns void
language sql security definer set search_path = '' as $$
  update public.email_outbox set
    status          = case when p_ok then 'sent'::public.email_status
                           when attempts >= 5 then 'failed'::public.email_status
                           else 'pending'::public.email_status end,
    sent_at         = case when p_ok then now() end,
    last_error      = case when p_ok then null else left(p_error, 1000) end,
    next_attempt_at = now() + make_interval(mins => power(2, attempts)::int)
  where id = p_id
$$;

-- ---------- Function privileges ----------------------------------------------
-- Internal helpers: nobody calls these directly through the API.
revoke execute on function public.enqueue_email(text, text, text, jsonb)             from public, anon, authenticated;
revoke execute on function public.on_account_confirmed(uuid)                         from public, anon, authenticated;
revoke execute on function public._attach_document(uuid, uuid, public.document_kind, text, text) from public, anon, authenticated;
revoke execute on function public.interview_payload(public.interviews, public.applications) from public, anon, authenticated;
revoke execute on function public.claim_email_batch(integer)                         from public, anon, authenticated;
revoke execute on function public.complete_email(bigint, boolean, text)              from public, anon, authenticated;
grant  execute on function public.claim_email_batch(integer)                         to service_role;
grant  execute on function public.complete_email(bigint, boolean, text)              to service_role;

-- User-facing RPCs: signed-in users only.
revoke execute on function public.submit_application(uuid, text, text, text, text, text, text, text, text, text, boolean, boolean, jsonb, text) from public, anon;
revoke execute on function public.add_or_replace_document(uuid, public.document_kind, text, text) from public, anon;
revoke execute on function public.mark_notifications_read(uuid[])  from public, anon;
revoke execute on function public.request_account_deletion(text)   from public, anon;
revoke execute on function public.log_document_access(uuid)        from public, anon;
revoke execute on function public.hr_overview_stats()              from public, anon;
grant  execute on function public.submit_application(uuid, text, text, text, text, text, text, text, text, text, boolean, boolean, jsonb, text) to authenticated;
grant  execute on function public.add_or_replace_document(uuid, public.document_kind, text, text) to authenticated;
grant  execute on function public.mark_notifications_read(uuid[])  to authenticated;
grant  execute on function public.request_account_deletion(text)   to authenticated;
grant  execute on function public.log_document_access(uuid)        to authenticated;
grant  execute on function public.hr_overview_stats()              to authenticated;

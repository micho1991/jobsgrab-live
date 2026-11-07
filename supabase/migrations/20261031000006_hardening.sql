-- =============================================================================
-- 0006 · Hardening
--   (a) Abuse limits enforced in the database, whichever client is used
--   (b) Maintenance functions for the daily `maintenance` Edge Function:
--       abandoned uploads, retention of rejected applications, log pruning
-- Limits are deliberately generous for real candidates and only stop scripts.
-- Auth endpoints (sign-up, sign-in, password reset) are rate limited by
-- Supabase Auth itself: see Dashboard → Authentication → Rate Limits.
-- =============================================================================

-- ---------- (a) Abuse limits -------------------------------------------------
-- At most 5 applications per candidate per 24 hours.
create or replace function public.limit_application_rate()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.applications
       where candidate_id = new.candidate_id and submitted_at > now() - interval '24 hours') >= 5 then
    raise exception 'You''ve submitted several applications today. Please try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger applications_rate_limit before insert on public.applications
  for each row execute function public.limit_application_rate();

-- At most 40 documents attached per candidate per 24 hours (replacements included).
create or replace function public.limit_document_rate()
returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.documents
       where owner_id = new.owner_id and created_at > now() - interval '24 hours') >= 40 then
    raise exception 'You''ve uploaded a lot of documents today. Please try again tomorrow.' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger documents_rate_limit before insert on public.documents
  for each row execute function public.limit_document_rate();

-- At most 60 file uploads per user per 24 hours, so the bucket can't be filled
-- with files that are never attached (those are also cleaned up daily).
create or replace function public.recent_upload_count()
returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from storage.objects
   where bucket_id = 'candidate-documents'
     and owner_id = (select auth.uid())::text
     and created_at > now() - interval '24 hours'
$$;
revoke execute on function public.recent_upload_count() from public, anon;
grant  execute on function public.recent_upload_count() to authenticated;

drop policy if exists "documents bucket: upload to own folder" on storage.objects;
create policy "documents bucket: upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'candidate-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and (select public.recent_upload_count()) < 60
  );

-- ---------- (b) Maintenance (service_role only) ------------------------------
-- Files uploaded but never attached to an application (e.g. an abandoned form).
-- Returns paths only: the Edge Function deletes them through the Storage API,
-- which also removes the underlying file (deleting rows here would not).
create or replace function public.maintenance_orphaned_uploads(p_min_age interval default '24 hours', p_limit integer default 500)
returns table (name text)
language sql stable security definer set search_path = '' as $$
  select o.name
    from storage.objects o
   where o.bucket_id = 'candidate-documents'
     and o.created_at < now() - p_min_age
     and not exists (select 1 from public.documents d where d.storage_path = o.name)
   order by o.created_at
   limit greatest(1, least(p_limit, 1000))
$$;

-- Retention: rejected applications are deleted p_months after the decision,
-- as the privacy policy states. Hired applications are kept (they move into
-- employment records). Returns the document paths so their files can be removed.
create or replace function public.maintenance_purge_expired_applications(p_months integer default 12, p_limit integer default 200)
returns table (application_id uuid, storage_path text)
language plpgsql security definer set search_path = '' as $$
declare
  v_ids uuid[];
begin
  if p_months < 6 then
    raise exception 'Retention period must be at least 6 months' using errcode = '22023';
  end if;
  select array_agg(x.id) into v_ids
    from (select a.id from public.applications a
           where a.status = 'rejected' and a.status_changed_at < now() - make_interval(months => p_months)
           order by a.status_changed_at
           limit greatest(1, least(p_limit, 1000))) x;
  if v_ids is null then return; end if;

  return query select d.application_id, d.storage_path from public.documents d where d.application_id = any (v_ids);

  delete from public.applications where id = any (v_ids);   -- cascades to documents, notes, history, interviews
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (null, 'retention_purge', 'application', null,
          jsonb_build_object('applications', array_length(v_ids, 1), 'retention_months', p_months));
end $$;

-- Data minimisation for operational tables.
create or replace function public.maintenance_prune_logs()
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  n_outbox int; n_notifications int; n_audit int;
begin
  delete from public.email_outbox where status in ('sent', 'failed') and created_at < now() - interval '30 days';
  get diagnostics n_outbox = row_count;
  delete from public.notifications where read_at is not null and created_at < now() - interval '12 months';
  get diagnostics n_notifications = row_count;
  delete from public.audit_log where created_at < now() - interval '24 months';
  get diagnostics n_audit = row_count;
  return jsonb_build_object('email_outbox', n_outbox, 'notifications', n_notifications, 'audit_log', n_audit);
end $$;

revoke execute on function public.maintenance_orphaned_uploads(interval, integer)        from public, anon, authenticated;
revoke execute on function public.maintenance_purge_expired_applications(integer, integer) from public, anon, authenticated;
revoke execute on function public.maintenance_prune_logs()                               from public, anon, authenticated;
grant  execute on function public.maintenance_orphaned_uploads(interval, integer)        to service_role;
grant  execute on function public.maintenance_purge_expired_applications(integer, integer) to service_role;
grant  execute on function public.maintenance_prune_logs()                               to service_role;

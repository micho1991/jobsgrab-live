-- =============================================================================
-- 0005 · Stage 4 fixes
-- (a) Role changes by HR admins failed with "permission denied for
-- table audit_log". protect_profile_columns() must run as the calling user (to
-- tell client requests apart), and API users may only read the audit log.
-- The audit write now goes through a narrow SECURITY DEFINER helper that only
-- records role changes and only for HR admins, so exposing it is harmless.
-- =============================================================================
create or replace function public.audit_role_change(p_target uuid, p_from public.app_role, p_to public.app_role)
returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_hr_admin() then
    raise exception 'Only HR administrators can change roles' using errcode = '42501';
  end if;
  insert into public.audit_log (actor_id, action, entity, entity_id, metadata)
  values (auth.uid(), 'role_changed', 'profile', p_target::text, jsonb_build_object('from', p_from, 'to', p_to));
end $$;
revoke execute on function public.audit_role_change(uuid, public.app_role, public.app_role) from public, anon;
grant  execute on function public.audit_role_change(uuid, public.app_role, public.app_role) to authenticated;

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
      perform public.audit_role_change(new.id, old.role, new.role);
    end if;
  end if;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- (b) Overview "by position": group free-text "Other" applications into one
-- bucket instead of listing each typed title as if it were a real position.
-- -----------------------------------------------------------------------------
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
    'by_position', (select coalesce(jsonb_agg(jsonb_build_object('id', x.position_id, 'title', x.title, 'n', x.n) order by x.n desc, x.title), '[]'::jsonb)
                      from (select a.position_id,
                                   coalesce(p.title, 'Other (not listed)') as title,
                                   count(*) as n
                              from public.applications a
                              left join public.positions p on p.id = a.position_id
                             group by a.position_id, p.title
                             order by 3 desc limit 10) x),
    'daily_last_30_days', (select jsonb_agg(jsonb_build_object('date', d::date, 'count',
                             (select count(*) from public.applications a
                               where a.submitted_at >= d and a.submitted_at < d + interval '1 day')) order by d)
                             from generate_series(current_date - 29, current_date, interval '1 day') d),
    'upcoming_interviews', (select count(*) from public.interviews
                             where cancelled_at is null and scheduled_at >= now()),
    'pending_deletion_requests', (select count(*) from public.deletion_requests where status = 'pending')
  );
end $$;

-- =============================================================================
-- 0003 · Row-Level Security
-- Principle: deny by default. Every table has RLS on; access is granted only by
-- the policies below. Writes that need business rules go through RPCs.
-- Role helpers are wrapped in (select ...) so Postgres evaluates them once per
-- statement instead of once per row.
-- =============================================================================

alter table public.profiles                   enable row level security;
alter table public.positions                  enable row level security;
alter table public.applications               enable row level security;
alter table public.documents                  enable row level security;
alter table public.application_status_history enable row level security;
alter table public.application_notes          enable row level security;
alter table public.interviews                 enable row level security;
alter table public.notifications              enable row level security;
alter table public.email_outbox               enable row level security;
alter table public.deletion_requests          enable row level security;
alter table public.audit_log                  enable row level security;

-- Anonymous visitors may only read open job positions.
revoke all on all tables    in schema public from anon;
revoke all on all sequences in schema public from anon;
grant select on public.positions to anon;

-- Service-only tables: no API access at all for signed-in users.
revoke all on public.email_outbox from authenticated;
revoke all on public.audit_log    from authenticated;
grant select on public.audit_log  to authenticated;   -- still gated by RLS (admins only)

-- ---------- profiles ---------------------------------------------------------
create policy "profiles: read own or HR reads all" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_hr()));

create policy "profiles: update own or admin updates any" on public.profiles
  for update to authenticated
  using      (id = (select auth.uid()) or (select public.is_hr_admin()))
  with check (id = (select auth.uid()) or (select public.is_hr_admin()));
-- Inserts come only from the auth trigger; deletes only via the GDPR process.

-- ---------- positions --------------------------------------------------------
create policy "positions: public reads accepting positions" on public.positions
  for select to anon, authenticated
  using (public.position_accepting(is_active, status, application_deadline) or (select public.is_hr()));

create policy "positions: admins insert" on public.positions
  for insert to authenticated with check ((select public.is_hr_admin()));
create policy "positions: admins update" on public.positions
  for update to authenticated
  using ((select public.is_hr_admin())) with check ((select public.is_hr_admin()));
create policy "positions: admins delete" on public.positions
  for delete to authenticated using ((select public.is_hr_admin()));

-- ---------- applications -----------------------------------------------------
create policy "applications: candidate reads own, HR reads all" on public.applications
  for select to authenticated
  using (candidate_id = (select auth.uid()) or (select public.is_hr()));

create policy "applications: recruiters update status" on public.applications
  for update to authenticated
  using ((select public.can_manage_applications()))
  with check ((select public.can_manage_applications()));

create policy "applications: admins delete" on public.applications
  for delete to authenticated using ((select public.is_hr_admin()));
-- Inserts only via submit_application().

-- ---------- documents --------------------------------------------------------
create policy "documents: owner or HR reads" on public.documents
  for select to authenticated
  using (owner_id = (select auth.uid()) or (select public.is_hr()));
-- Inserts/replacements only via RPCs.

-- ---------- status history ---------------------------------------------------
create policy "status history: candidate reads own timeline, HR reads all" on public.application_status_history
  for select to authenticated
  using ((select public.is_hr())
         or exists (select 1 from public.applications a
                     where a.id = application_id and a.candidate_id = (select auth.uid())));

-- ---------- internal HR notes: HR ONLY ---------------------------------------
create policy "notes: HR reads" on public.application_notes
  for select to authenticated using ((select public.is_hr()));
create policy "notes: recruiters write as themselves" on public.application_notes
  for insert to authenticated
  with check ((select public.can_manage_applications()) and author_id = (select auth.uid()));
create policy "notes: authors edit own" on public.application_notes
  for update to authenticated
  using      ((select public.can_manage_applications()) and author_id = (select auth.uid()))
  with check ((select public.can_manage_applications()) and author_id = (select auth.uid()));
create policy "notes: authors or admins delete" on public.application_notes
  for delete to authenticated
  using ((select public.is_hr())
         and (author_id = (select auth.uid()) or (select public.is_hr_admin())));

-- ---------- interviews -------------------------------------------------------
create policy "interviews: candidate reads own, HR reads all" on public.interviews
  for select to authenticated
  using ((select public.is_hr())
         or exists (select 1 from public.applications a
                     where a.id = application_id and a.candidate_id = (select auth.uid())));
create policy "interviews: recruiters schedule" on public.interviews
  for insert to authenticated with check ((select public.can_manage_applications()));
create policy "interviews: recruiters update" on public.interviews
  for update to authenticated
  using ((select public.can_manage_applications())) with check ((select public.can_manage_applications()));
create policy "interviews: admins delete" on public.interviews
  for delete to authenticated using ((select public.is_hr_admin()));

-- ---------- notifications ----------------------------------------------------
create policy "notifications: read own" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
-- Marking as read goes through mark_notifications_read().

-- ---------- deletion requests ------------------------------------------------
create policy "deletion: read own, admins read all" on public.deletion_requests
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_hr_admin()));
create policy "deletion: admins update" on public.deletion_requests
  for update to authenticated
  using ((select public.is_hr_admin())) with check ((select public.is_hr_admin()));

-- ---------- audit log --------------------------------------------------------
create policy "audit: admins read" on public.audit_log
  for select to authenticated using ((select public.is_hr_admin()));

-- ---------- Realtime (live status updates in dashboards / mobile) ------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.notifications, public.applications;
  end if;
end $$;

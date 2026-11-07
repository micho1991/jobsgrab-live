-- =============================================================================
-- 0004 · Private document storage
-- Files are stored at  candidate-documents/{user_id}/{random-uuid}.{ext}
-- The bucket is private: files are only ever served through short-lived signed
-- URLs, and only to the owner or to HR staff.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'candidate-documents', 'candidate-documents', false, 10485760,  -- 10 MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Candidates upload only into their own top-level folder.
create policy "documents bucket: upload to own folder" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'candidate-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Owners read their own files; HR staff read all candidate files.
create policy "documents bucket: owner reads own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'candidate-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "documents bucket: HR reads all" on storage.objects
  for select to authenticated
  using (bucket_id = 'candidate-documents' and (select public.is_hr()));

-- Owners may delete only files that were never attached to an application
-- (e.g. an upload abandoned mid-form). Attached files are kept for HR history.
create policy "documents bucket: owner deletes unattached" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'candidate-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and not exists (select 1 from public.documents d where d.storage_path = name)
  );
-- No UPDATE policy: files are immutable; replacing a document creates a new object.

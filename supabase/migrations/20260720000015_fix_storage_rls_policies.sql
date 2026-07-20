-- Patch: make storage RLS policies idempotent
-- This re-creates policies using safe idempotent DDL since the original
-- 20260720000014 migration partially failed on the remote database.

drop policy if exists "cover_images_public_select" on storage.objects;
drop policy if exists "cover_images_authenticated_insert" on storage.objects;
drop policy if exists "cover_images_authenticated_update" on storage.objects;
drop policy if exists "cover_images_authenticated_delete" on storage.objects;

create policy "cover_images_public_select"
  on storage.objects for select
  to public
  using (bucket_id = 'competition-covers');

create policy "cover_images_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'competition-covers');

create policy "cover_images_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'competition-covers' and auth.uid() = owner);

create policy "cover_images_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'competition-covers' and auth.uid() = owner);
-- Add RLS policies for competition-covers storage bucket
-- Without these, storage.objects denies all operations by default

-- Allow public read access to cover images
drop policy if exists "cover_images_public_select" on storage.objects;
create policy "cover_images_public_select"
  on storage.objects for select
  to public
  using (bucket_id = 'competition-covers');

-- Allow authenticated users to upload cover images
drop policy if exists "cover_images_authenticated_insert" on storage.objects;
create policy "cover_images_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'competition-covers');

-- Allow authenticated users to update their own uploads
drop policy if exists "cover_images_authenticated_update" on storage.objects;
create policy "cover_images_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'competition-covers' and auth.uid() = owner);

-- Allow authenticated users to delete their own uploads
drop policy if exists "cover_images_authenticated_delete" on storage.objects;
create policy "cover_images_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'competition-covers' and auth.uid() = owner);

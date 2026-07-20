-- Add cover_image and content to competitions
alter table competitions
  add column cover_image text,
  add column content jsonb;

-- Add cover_image to events
alter table events
  add column cover_image text;

-- Create storage bucket for cover images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'competition-covers',
  'competition-covers',
  true,
  10485760,
  array['image/png', 'image/jpeg', 'image/webp']
);

-- Allow public read access to cover images
create policy "cover_images_public_select"
  on storage.objects for select
  to public
  using (bucket_id = 'competition-covers');

-- Allow authenticated users to upload cover images
create policy "cover_images_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'competition-covers');

-- Allow authenticated users to update their own uploads
create policy "cover_images_authenticated_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'competition-covers' and auth.uid() = owner);

-- Allow authenticated users to delete their own uploads
create policy "cover_images_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'competition-covers' and auth.uid() = owner);

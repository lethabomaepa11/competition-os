### Task 1: Migration — Add columns + storage bucket

**Files:**
- Create: `supabase/migrations/20260720000012_competition_content.sql`

- [ ] **Step 1: Write migration**

```sql
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
```

- [ ] **Step 2: Run migration**

Run: `supabase migration up`
Expected: "Applied migration 20260720000012_competition_content.sql"

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260720000012_competition_content.sql
git commit -m "feat: add cover_image and content columns, storage bucket"
```
